import io.javalin.Javalin;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicReference;

public class Main {

    private static final AtomicReference<MachineTranslator> translatorRef = new AtomicReference<>(null);

    public static void main(String[] args){

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
        var app = Javalin.create(
                config -> {
                    config.routes.post("/translate", ctx -> {
                        MachineTranslator translator = translatorRef.get();
                        if(translator == null){
                            ctx.status(503);
                            return;
                        }
                        TranslationRequest req = ctx.bodyAsClass(TranslationRequest.class);
                        String translated = translator.translate(req.text(), req.srcLan(), req.trgLan());
                        if(translated == null){
                            ctx.status(400);
                        }else
                            ctx.json(new TranslationRequest(req.srcLan(), req.trgLan(), translated));
                    });
                    config.routes.get("/connect", ctx -> {
                        if(translatorRef.get() != null)
                            ctx.status(200);
                        else
                            ctx.status(503);
                    });
                }
        ).start(0);
        int port = app.port();
        System.out.println("SERVER_PORT: " + port);
        translatorRef.set(new MachineTranslator(conf));
    }
}
