import ai.djl.ndarray.NDList;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;

public class DecoderTranslator implements Translator<DecoderInput, NDList> {

    @Override
    public Batchifier getBatchifier() {
        return null;
    }

    @Override
    public NDList processInput(TranslatorContext translatorContext, DecoderInput input) throws Exception {
        return null;
    }

    @Override
    public NDList processOutput(TranslatorContext translatorContext, NDList ndList) throws Exception {
        return ndList;
    }
}
