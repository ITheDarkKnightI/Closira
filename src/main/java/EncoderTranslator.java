import ai.djl.ndarray.NDList;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;

public class EncoderTranslator implements Translator<String, NDList> {
    @Override
    public NDList processInput(TranslatorContext translatorContext, String s) throws Exception {
        return null;
    }

    @Override
    public NDList processOutput(TranslatorContext translatorContext, NDList ndList) throws Exception {
        return null;
    }

    @Override
    public Batchifier getBatchifier() {
        return null;
    }
}
