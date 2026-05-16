import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;

public class EncoderTranslator implements Translator<long[][], NDList> {
    @Override
    public NDList processInput(TranslatorContext translatorContext, long[][] input) throws Exception {
        NDManager ndManager = translatorContext.getNDManager();
        long[] indices = input[0];
        long[] attentionMask = input[1];
        NDArray indicesTensor = ndManager.create(indices).reshape(1, indices.length);
        NDArray attentionMaskTensor = ndManager.create(attentionMask).reshape(1, attentionMask.length);
        translatorContext.setAttachment("indices", indicesTensor);
        translatorContext.setAttachment("attentionMask", attentionMaskTensor);
        return new NDList(indicesTensor, attentionMaskTensor);
    }

    @Override
    public NDList processOutput(TranslatorContext translatorContext, NDList ndList) throws Exception {
        ndList.detach();
        return ndList;
    }

    @Override
    public Batchifier getBatchifier() {
        return null;
    }
}
