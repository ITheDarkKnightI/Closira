import io.javalin.Javalin;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;

public class Main {

    private static final AtomicReference<MachineTranslator> translatorRef = new AtomicReference<>(null);
    private static final DataBase DATA_BASE = new DataBase();

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
                        if(req.text() == null || req.text().isBlank()){
                            ctx.status(400);
                            return;
                        }
                        BreakIterator iterator = BreakIterator.getSentenceInstance(Locale.forLanguageTag(req.srcLan()));
                        iterator.setText(req.text());
                        StringBuilder translated = new StringBuilder();
                        int start = iterator.first();
                        for(int end = iterator.next(); end != BreakIterator.DONE; start = end, end = iterator.next()) {
                            String sentence = req.text().substring(start, end);

                            String trimmedSentence = sentence.trim();
                            if (!trimmedSentence.isEmpty()) {
                                String translatedSentence = translator.translate(trimmedSentence, req.srcLan(), req.trgLan());
                                translated.append(translatedSentence);

                                if (sentence.endsWith(" ")) {
                                    translated.append(" ");
                                } else if (end < req.text().length()){
                                    translated.append(" ");
                                }
                            }
                        }
                        if(translated.isEmpty()){
                            ctx.status(400);
                        }else
                            ctx.json(new TranslationRequest(req.srcLan(), req.trgLan(), translated.toString()));
                    });
                    config.routes.get("/connect", ctx -> {
                        if(translatorRef.get() != null) {
                            ArrayList<LanguageInfo> languages = new ArrayList<>();
                            ResultSet languagesData = DATA_BASE.getTheSet("languages", "id", "name",
                                    "nllb_name", "ocr_name");
                            while(languagesData.next()){
                                languages.add(new LanguageInfo(languagesData.getInt("id"),
                                        languagesData.getString("name"), languagesData.getString("nllb_name"),
                                        languagesData.getString("ocr_name")));
                            }
                            ctx.json(languages);
                            ctx.status(200);
                        }else
                            ctx.status(503);
                    });
                }
        );
        int port = app.port();
        System.out.println("SERVER_PORT: " + port);
//        translatorRef.set(new MachineTranslator(conf));
    }
}
