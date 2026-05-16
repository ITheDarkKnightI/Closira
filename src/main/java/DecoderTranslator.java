import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
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
        NDManager ndManager = translatorContext.getNDManager();
        long[] attentionMask = input.encoderAttentionMask();
        NDArray currentTokenTensor = ndManager.create(input.currentToken()).reshape(1, 1);
        NDArray attentionMaskTensor = ndManager.create(attentionMask).reshape(1, attentionMask.length);
        NDList KVCache = input.pastKeyValues();
        NDArray useCacheBranch = input.useCacheBranch();

        NDList decoderInput = new NDList(attentionMaskTensor, currentTokenTensor);
        decoderInput.addAll(KVCache);
        decoderInput.add(useCacheBranch);
        return decoderInput;
    }

    @Override
    public NDList processOutput(TranslatorContext translatorContext, NDList ndList) throws Exception {
        return ndList;
    }
}
