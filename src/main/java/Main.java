import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;

public class Main {
    public static void main(String[] args){
        Scanner scanner = new Scanner(System.in);
        String text = "";
        String src = "eng_Latn";
        String targ = "rus_Cyrl";
        String path = "C:\\Users\\Serhii\\Downloads";
        Map<String, Path> map = new HashMap<>();
        map.put("encoder", Paths.get(path));
        map.put("decoder", Paths.get(path));
        map.put("tokenizer", Paths.get(path));
        ModelConfig config = new ModelConfig(
                "Nllb",
                "ONNX",
                map
        );
        MachineTranslator translator = new MachineTranslator(config);
        while(text != "exiq"){
            text = scanner.nextLine();
            translator.translate(text, src, targ);
            System.out.println("translated text: " + text);
        }
    }
}
