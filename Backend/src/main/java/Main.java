import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;

public class Main {

    public static void main(String[] args){

        int port = Integer.parseInt(args[0]);
        HashMap<String, Path> paths = new HashMap<>();
        Path homePath = Paths.get(System.getProperty("user.home"), "Downloads");
        paths.put("encoder", homePath);
        paths.put("decoder", homePath);
        paths.put("tokenizer", homePath);
        ModelConfig conf = new ModelConfig(
                "NLLB-200-600M",
                "ONNX",
                paths
        );
        MachineTranslator translator = MachineTranslatorFabric.createTranslator(config);
        while(!text.equals("exit")){
          text = scanner.nextLine();
            long startTime = System.currentTimeMillis();
            text = translator.translate(text, src, targ);
            System.out.println("translated text: " + text);
            long endTime = System.currentTimeMillis();
            System.out.println("Time: " + (endTime - startTime) + " miliSec");
        }
    }
}
