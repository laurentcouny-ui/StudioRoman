package com.scriptor.api.modules.universe;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
/**
 * Chronologie synchronisée depuis le projet Scriptor (fichier JSON, pas SQLite).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChronologyContextService {

    private final ObjectMapper objectMapper;

    @Value("${scriptor.data.dir:./config/data}")
    private String dataDir;

    private Path chronologyFile() {
        return Paths.get(dataDir, "chronology-context.json");
    }

    public void writeFromSync(List<ProjectUniverseSyncRequest.TimelineEventDto> events) {
        try {
            Path p = chronologyFile();
            Files.createDirectories(p.getParent());
            ObjectNode root = objectMapper.createObjectNode();
            ArrayNode arr = objectMapper.createArrayNode();
            if (events != null) {
                for (ProjectUniverseSyncRequest.TimelineEventDto e : events) {
                    if (e == null) continue;
                    ObjectNode n = objectMapper.createObjectNode();
                    n.put("title", e.getTitle() != null ? e.getTitle() : "");
                    n.put("dateLabel", e.getDateLabel() != null ? e.getDateLabel() : "");
                    n.put("description", e.getDescription() != null ? e.getDescription() : "");
                    arr.add(n);
                }
            }
            root.set("events", arr);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(p.toFile(), root);
            log.info("Chronologie synchronisée ({} événements).", arr.size());
        } catch (Exception e) {
            log.error("Écriture chronology-context.json impossible.", e);
        }
    }

    /**
     * Texte compact pour injection dans les prompts (page blanche, etc.).
     */
    public String readSummary(int maxChars) {
        File f = chronologyFile().toFile();
        if (!f.exists()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(f);
            JsonNode events = root.path("events");
            if (!events.isArray() || events.isEmpty()) {
                return "";
            }
            StringBuilder sb = new StringBuilder();
            for (JsonNode ev : events) {
                String line = String.format(
                        "• %s [%s] — %s\n",
                        ev.path("title").asText(""),
                        ev.path("dateLabel").asText(""),
                        ev.path("description").asText("").replace('\n', ' ')
                );
                if (sb.length() + line.length() > maxChars) {
                    break;
                }
                sb.append(line);
            }
            return sb.toString().trim();
        } catch (Exception e) {
            log.warn("Lecture chronology-context.json impossible.", e);
            return "";
        }
    }
}
