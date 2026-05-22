import io.javalin.Javalin;
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
        MachineTranslator translator = MachineTranslatorFabric.createTranslator(conf);
        var app = Javalin.create(
                config -> {
                    config.routes.post("/translate", ctx -> {
                        TranslationRequest req = ctx.bodyAsClass(TranslationRequest.class);
                        String translated = translator.translate(req.text(), req.srcLan(), req.trgLan());
                        if(translated == null){
                            ctx.status(400);
                        }else
                            ctx.json(new TranslationRequest(req.srcLan(), req.trgLan(), translated));
                    });
                    config.routes.get("/connect", ctx -> {
                        if(translator.isLoaded())
                            ctx.status(200);
                        else
                            ctx.status(503);
                    });
                }
        ).start(port);
    }
}
