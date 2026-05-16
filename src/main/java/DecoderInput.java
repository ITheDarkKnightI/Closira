import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;

public record DecoderInput(
       long currentToken,
       long[] encoderAttentionMask,
       NDArray encoderHiddenStates,
       NDList pastKeyValues,
       NDArray useCacheBranch
) { }
