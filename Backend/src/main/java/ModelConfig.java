import java.nio.file.Path;
import java.util.Map;

public record ModelConfig(
        String modelName,
        String modelType,
        Map<String, Path> componentPaths
) { }
