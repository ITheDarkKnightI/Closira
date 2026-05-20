import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.inference.Predictor;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.ndarray.types.Shape;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.translate.Translator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.beans.PropertyEditorSupport;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;

public class MachineTranslator {

    private final int DECODER_LAYERS = 12; // Constant for working only with NLLB
    private final ZooModel<long[][], NDList> ENCODER;
    private final ZooModel<DecoderInput, NDList> DECODER;
    private final HuggingFaceTokenizer TOKENIZER;
    private static final Logger log = LoggerFactory.getLogger(MachineTranslator.class);
    public MachineTranslator(ModelConfig config){
        Map<String, Path> paths= config.componentPaths();

        Path encoderPath = Objects.requireNonNull(paths.get("encoder"), "Encoder not found");
        Path decoderPath = Objects.requireNonNull(paths.get("decoder"), "Decoder not found");
        Path tokenizerPath = Objects.requireNonNull(paths.get("tokenizer"), "Tokenizer not found");
        log.info("Path");
        try {
            this.DECODER = createCriteria(decoderPath, "decoder_model_merged_quantized.onnx",
                    new DecoderTranslator(), DecoderInput.class, NDList.class).loadModel();
            this.ENCODER = createCriteria(encoderPath, "encoder_model_quantized.onnx",
                    new EncoderTranslator(), long[][].class, NDList.class).loadModel();
            this.TOKENIZER = HuggingFaceTokenizer.newInstance(tokenizerPath);
        }catch(Exception e){
            throw new RuntimeException("Error initializing objects: ", e);
        }
        log.info("Model is initialized");
    }
    /**
     A method that returns a Criteria<I, O>
     ...Params.description...
     */
    private <I, O> Criteria<I, O> createCriteria(Path modelPath, String modelName,
                                                 Translator<I, O> translator,
                                                 Class<I> inputType, Class<O> outputType){
        log.info("Criteria create");
        return Criteria.builder().setTypes(inputType, outputType).optModelPath(modelPath).optModelName(modelName)
                .optTranslator(translator).optEngine("OnnxRuntime").build();
    }

    /**
     *
     * @param srcText
     * @param srcLang
     * @param targLang
     * @return
     */

    public String translate(String srcText, String srcLang, String targLang){
        Encoding encoding = TOKENIZER.encode(srcText, true, false);
        long[] indices = encoding.getIds();
        long[] attentionMask = encoding.getAttentionMask();
        long srcLangToken = TOKENIZER.encode(srcLang, false, false).getIds()[0];
        indices[0] = srcLangToken;
        long targLangToken = TOKENIZER.encode(targLang, false, false).getIds()[0];
        ModelParameters parameters = new ModelParameters(12, 16, 64);
        ArrayList<Long> resultTokenList = new ArrayList<>();
        log.info("Data for translate initialized");

        try (NDManager manager = NDManager.newBaseManager();
             Predictor<long[][], NDList> encoderPredictor = ENCODER.newPredictor();
             Predictor<DecoderInput, NDList> decoderPredictor = DECODER.newPredictor()){
            log.info("Start of translating");
            long currentToken = 2L;
            NDList encoderOutput = encoderPredictor.predict(new long[][]{indices, attentionMask});
            encoderOutput.attach(manager);
            NDList decoderKVCache = createInitialKVCache(manager, parameters, indices.length);
            NDArray useCacheBranch = manager.create(new boolean[]{false});
            DecoderInput decoderInput = new DecoderInput(currentToken, attentionMask, encoderOutput.getFirst(),
                    decoderKVCache, useCacheBranch);
            log.info("Created DecoderInput");
            log.info("*Start of cycle*");
            for(int i = 0; i < 512; i++){
                try(NDManager subManager = manager.newSubManager()){
                    NDList decoderOutput = decoderPredictor.predict(decoderInput);
                    decoderOutput.attach(subManager);
                    NDArray logits = decoderOutput.getFirst();

                    NDArray bestTokenIdTensor = logits.argMax(2);
                    long predictedTokenId = bestTokenIdTensor.getLong(0, -1);
                    if(i == 0)
                        predictedTokenId = targLangToken;
                    resultTokenList.add(predictedTokenId);
                    decoderInput = decoderInput.withToken(predictedTokenId);

                    if(i == 0){
                        for(int j = 0; j < parameters.layers() * 4; j++){
                            NDArray newTensor = decoderOutput.get(j + 1);
                            newTensor.attach(manager);
                            decoderKVCache.set(j, newTensor).close();
                        }
                        decoderInput = decoderInput.withUseCacheBranch(manager.create(new boolean[]{true}));
                    }else{
                        for(int j = 0; j < parameters.layers(); j++){
                            NDArray newKey = decoderOutput.get(j*4+1);
                            NDArray newValue = decoderOutput.get(j*4+2);
                            newKey.attach(manager);
                            newValue.attach(manager);
                            decoderKVCache.set(j * 4, newKey).close();
                            decoderKVCache.set(j * 4 + 1, newValue).close();
                        }
                    }
                    if(predictedTokenId == 2L) // 2L is end-code for NLLB-200
                        break;
                }
            }
            log.info("*End of cycle*");
        }catch(Exception e){
            throw new RuntimeException("Translation error", e);
        }
        long[] resultTokens = resultTokenList.stream().mapToLong(Long::longValue).toArray();
        return TOKENIZER.decode(resultTokens);
    }

    /**
     *
     * @param manager
     * @param params
     * @param encoderSeqLength
     * @return
     */

    private NDList createInitialKVCache(NDManager manager, ModelParameters params, int encoderSeqLength){
        NDList KVCache = new NDList();
        Shape decoderCacheShape = new Shape(1, params.heads(), 1, params.headDim());
        Shape encoderCacheShape = new Shape(1, params.heads(), encoderSeqLength, params.headDim());
        for(int i = 0; i < params.layers(); i++){
            KVCache.add(manager.zeros(decoderCacheShape));
            KVCache.add(manager.zeros(decoderCacheShape));

            KVCache.add(manager.zeros(encoderCacheShape));
            KVCache.add(manager.zeros(encoderCacheShape));
        }
        return KVCache;
    }
}
