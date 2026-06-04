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

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;

public class MachineTranslator {

    private final int DECODER_LAYERS = 12; // Constant for working only with NLLB-200 quantized
    private final static int availableCores = Runtime.getRuntime().availableProcessors();
    private final ZooModel<long[][], NDList> ENCODER;
    private final Predictor<long[][], NDList> encoderPredictor;
    private final ZooModel<DecoderInput, NDList> DECODER;
    private final Predictor<DecoderInput, NDList> decoderPredictor;
    private final HuggingFaceTokenizer TOKENIZER;
    private static final Logger log = LoggerFactory.getLogger(MachineTranslator.class);
    private boolean status = false;
    public MachineTranslator(ModelConfig config){
        Map<String, Path> paths= config.componentPaths();

        Path encoderPath = Objects.requireNonNull(paths.get("encoder"), "Encoder not found");
        Path decoderPath = Objects.requireNonNull(paths.get("decoder"), "Decoder not found");
        Path tokenizerPath = Objects.requireNonNull(paths.get("tokenizer"), "Tokenizer not found");
        log.info("Path");
        try {
            this.DECODER = createCriteria(decoderPath, "decoder_model_merged_quantized.onnx",
                    new DecoderTranslator(), DecoderInput.class, NDList.class).loadModel();
            this.decoderPredictor = DECODER.newPredictor();
            this.ENCODER = createCriteria(encoderPath, "encoder_model_quantized.onnx",
                    new EncoderTranslator(), long[][].class, NDList.class).loadModel();
            this.encoderPredictor = ENCODER.newPredictor();
            this.TOKENIZER = HuggingFaceTokenizer.newInstance(tokenizerPath);
        }catch(Exception e){
            throw new RuntimeException("Error initializing objects: ", e);
        }
        status = true;
        log.info("Model is initialized");
    }
    /**
     * A method that returns a Criteria<I, O> for initializing the model
     */
    private <I, O> Criteria<I, O> createCriteria(Path modelPath, String modelName,
                                                 Translator<I, O> translator,
                                                 Class<I> inputType, Class<O> outputType){
        log.info("Criteria create");
        return Criteria.builder().setTypes(inputType, outputType).optModelPath(modelPath).optModelName(modelName)
                .optTranslator(translator).optEngine("OnnxRuntime").optOption("ai.djl.onnxruntime.num_threads", String.valueOf(availableCores))
                // Количество потоков для параллельного выполнения независимых операторов в графе (inter-op)
                .optOption("ai.djl.onnxruntime.inter_op_num_threads", String.valueOf(availableCores)).build();
    }

    /**
     * Machine translation via NLLB-200
     * The link showing all language codes: <a href="https://github.com/facebookresearch/flores/blob/main/flores200/README.md#languages-in-flores-200">languages-in-flores-200</a>
     *
     * @param srcText Source text
     * @param srcLang Code of source language (for example "eng_Latn")
     * @param targLang Code of target language (same as srcLang)
     * @return Returns the translated text, stripped of additional identifiers.
     */

    public synchronized String translate(String srcText, String srcLang, String targLang){
        Encoding encoding = TOKENIZER.encode(srcText, true, false);
        long[] indices = encoding.getIds();
        long[] attentionMask = encoding.getAttentionMask();
        long srcLangToken = TOKENIZER.encode(srcLang, false, false).getIds()[0];
        indices[0] = srcLangToken;
        long targLangToken = TOKENIZER.encode(targLang, false, false).getIds()[0];
        ModelParameters parameters = new ModelParameters(12, 16, 64);
        ArrayList<Long> resultTokenList = new ArrayList<>();
        log.info("Data for translate initialized");

        try (NDManager manager = NDManager.newBaseManager()){
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
        return clearText(TOKENIZER.decode(resultTokens));
    }

    /**
     * Initializes an empty Key/Value cache for the decoder.
     * Generates zero-filled tensors for both decoder self-attention and encoder-decoder cross-attention.
     *
     * @param manager NDManager from the upper scope. It must be passed from the outside
     * so the native memory tensors are not prematurely destroyed when a local scope closes.
     * @param params Model configuration parameters (number of layers, attention heads, and head dimensions)
     * @param encoderSeqLength  length of input sentence (number of tokens)
     * @return An NDList representing the initial Key/Value cache for all model layers.
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

    /**
     * Cleans the translated text by removing special model tokens
     * it strips the trailing End-Of-Sequence (EOS) token and the leading language tag
     *
     * @param translatedText The raw decoded string output from the model
     * @return               The cleaned string containing only the actual translation
     */
    private String clearText(String translatedText){
        String text = translatedText;
        if (text.endsWith("</s>")) {
            text = text.substring(0, text.length() - 4);
        }
        int spaceIdx = text.indexOf(" ");
        if (spaceIdx >= 0) {
            text = text.substring(spaceIdx + 1);
        }
        return text;
    }
    public boolean isLoaded(){
        return status;
    }
}
