import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;

public record DecoderInput(
       long currentToken,
       long[] encoderAttentionMask,
       NDArray encoderHiddenStates,
       NDList pastKeyValues,
       NDArray useCacheBranch
) {
    public DecoderInput withToken(long newToken){
        return new DecoderInput(newToken, this.encoderAttentionMask, this.encoderHiddenStates,
                this.pastKeyValues, this.useCacheBranch);
    }

    public DecoderInput withCache(NDList newCache){
        return new DecoderInput(currentToken, this.encoderAttentionMask, this.encoderHiddenStates,
                newCache, this.useCacheBranch);
    }

    public DecoderInput withUseCacheBranch(NDArray newStatus){
        return new DecoderInput(currentToken, this.encoderAttentionMask, this.encoderHiddenStates,
                this.pastKeyValues, newStatus);
    }
}
