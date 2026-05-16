import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.inference.Predictor;
import ai.djl.ndarray.NDList;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.translate.Translator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.util.Map;
import java.util.Objects;

public class MachineTranslator {

    private final int DECODER_LAYERS = 12; // Constant for working only with NLLB
    private final ZooModel<Encoding, NDList> ENCODER;
    private final Predictor<Encoding, NDList> ENCODER_PREDICTOR;
    private final ZooModel<NDList, NDList> DECODER;
    private final Predictor<NDList, NDList> DECODER_PREDICTOR;
    private final HuggingFaceTokenizer TOKENIZER;
    private static final Logger log = LoggerFactory.getLogger(MachineTranslator.class);
    public MachineTranslator(ModelConfig config){
        Map<String, Path> paths= config.componentPaths();

        Path encoderPath = Objects.requireNonNull(paths.get("encoder"), "Encoder not found");
        Path decoderPath = Objects.requireNonNull(paths.get("decoder"), "Decoder not found");
        Path tokenizerPath = Objects.requireNonNull(paths.get("tokenizer"), "Tokenizer not found");
        try {
            this.DECODER = createCriteria(decoderPath, "decoder_model_merged_quantized.onnx",
                    new DecoderTranslator(), NDList.class, NDList.class).loadModel();
            this.DECODER_PREDICTOR = DECODER.newPredictor();
            this.ENCODER = createCriteria(encoderPath, "encoder_model_quantized.onnx",
                    new EncoderTranslator(), Encoding.class, NDList.class).loadModel();
            this.ENCODER_PREDICTOR = ENCODER.newPredictor();
            this.TOKENIZER = HuggingFaceTokenizer.newInstance(tokenizerPath);
        }catch(Exception e){
            throw new RuntimeException("Error initializing objects: ", e);
        }
    }
    /*******
     A method that returns a Criteria<I, O>
     ...Params.description...
     *******/
    private <I, O> Criteria<I, O> createCriteria(Path modelPath, String modelName,
                                                 Translator<I, O> translator,
                                                 Class<I> inputType, Class<O> outputType){
        return Criteria.builder().setTypes(inputType, outputType).optModelPath(modelPath).optModelName(modelName)
                .optTranslator(translator).optEngine("OnnxRuntime").build();
    }

    public String translate(String srcText, String srcLang, String targLang){
        Encoding encoding = TOKENIZER.encode(srcText, true, false);
        long[] indices = encoding.getIds();
        long[] attentionMask = encoding.getAttentionMask();
        long srcLangToken = TOKENIZER.encode(srcLang).getIds()[0];
        long targLangToken = TOKENIZER.encode(targLang).getIds()[0];
        try {
            NDList encoderOutput = ENCODER_PREDICTOR.predict(encoding);
        }catch(Exception e){
            throw new RuntimeException("Translation error", e);
        }
        return "";
    }
}
