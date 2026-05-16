public class MachineTranslatorFabric {
    public static MachineTranslator createTranslator(ModelConfig config){
        return new MachineTranslator(config);
    }
}
