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

    private final int DECODER_LAYERS;
    private final ZooModel<String, NDList> ENCODER;
    private final Predictor<String, NDList> ENCODER_PREDICTOR;
    private final ZooModel<NDList, NDList> DECODER;
    private final Predictor<NDList, NDList> DECODER_PREDICTOR;
    private final HuggingFaceTokenizer TOKENIZER;
    private static final Logger log = LoggerFactory.getLogger(MachineTranslator.class);
    public MachineTranslator(ModelConfig config){
        Map<String, Path> paths= config.componentPaths();

        Path encoderPath = Objects.requireNonNull(paths.get("encoder"), "Encoder not found");
        Path decoderPath = Objects.requireNonNull(paths.get("decoder"), "Decoder not found");
        Path tokenizer = Objects.requireNonNull(paths.get("tokenizer"), "Tokenizer not found");

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
}
