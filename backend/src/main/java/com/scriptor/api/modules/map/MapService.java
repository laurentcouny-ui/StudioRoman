package com.scriptor.api.modules.map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;

/**
 * Service gérant la vérification de cohérence géographique et temporelle.
 * Fait partie de la Phase 3 (Analyse à la demande).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MapService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final ObjectMapper objectMapper;

    @Value("${scriptor.data.dir:./config/data}")
    private String dataDir;

    /**
     * Charge les données géographiques depuis le fichier local.
     */
    public JsonNode getMapData() {
        File mapFile = Paths.get(dataDir, "map-data.json").toFile();
        if (mapFile.exists()) {
            try {
                return objectMapper.readTree(mapFile);
            } catch (Exception e) {
                log.error("Erreur lors de la lecture de map-data.json", e);
            }
        }
        // Retourne une structure vide par défaut si le fichier est corrompu ou illisible
        return objectMapper.createObjectNode()
                .set("lieux", objectMapper.createArrayNode());
    }

    /**
     * Recherche locale dans map-data.json (anti-hallucination : uniquement les données fichier).
     */
    public String searchMapData(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return "Requête invalide.";
        }
        String kw = keyword.trim().toLowerCase(Locale.ROOT);
        JsonNode root = getMapData();
        StringBuilder sb = new StringBuilder();
        int matches = 0;
        matches += appendArrayMatches(sb, root.path("lieux"), "lieu", kw);
        matches += appendArrayMatches(sb, root.path("trajets"), "trajet", kw);
        Iterator<String> names = root.fieldNames();
        while (names.hasNext()) {
            String key = names.next();
            if ("lieux".equals(key) || "trajets".equals(key)) {
                continue;
            }
            JsonNode val = root.get(key);
            if (val != null && val.isArray()) {
                matches += appendArrayMatches(sb, val, key, kw);
            }
        }
        if (matches == 0) {
            return "Information introuvable dans les données carte (map-data.json). Ne déduisez rien : cet élément n'est pas documenté.";
        }
        return sb.toString().trim();
    }

    private int appendArrayMatches(StringBuilder sb, JsonNode arrayNode, String label, String kw) {
        if (arrayNode == null || !arrayNode.isArray() || arrayNode.size() == 0) {
            return 0;
        }
        int count = 0;
        int i = 0;
        for (JsonNode n : arrayNode) {
            i++;
            if (nodeContainsKeyword(n, kw)) {
                count++;
                sb.append("[Source: Carte — ").append(label).append(", entrée ").append(i).append("]\n");
                try {
                    sb.append(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(n));
                } catch (Exception e) {
                    sb.append(n.toString());
                }
                sb.append("\n\n");
            }
        }
        return count;
    }

    private boolean nodeContainsKeyword(JsonNode n, String kw) {
        if (n == null) {
            return false;
        }
        return n.toString().toLowerCase(Locale.ROOT).contains(kw);
    }

    public void saveMapData(JsonNode data) {
        try {
            File mapFile = Paths.get(dataDir, "map-data.json").toFile();
            if (!mapFile.getParentFile().exists()) mapFile.getParentFile().mkdirs();
            File tempFile = new File(mapFile.getAbsolutePath() + ".tmp");
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tempFile, data);
            try {
                Files.move(
                        tempFile.toPath(),
                        mapFile.toPath(),
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE
                );
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(tempFile.toPath(), mapFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            log.info("Données géographiques sauvegardées avec succès.");
        } catch (Exception e) {
            log.error("Erreur lors de la sauvegarde de map-data.json", e);
            throw new RuntimeException("Échec de sauvegarde des données géographiques.", e);
        }
    }

    /**
     * Lance une analyse asynchrone pour vérifier la cohérence du texte avec la carte.
     */
    public CompletableFuture<String> verifyConsistency(String text) {
        log.info("Lancement de la vérification de cohérence géographique...");

        String mapDataString = getMapData().toString();
        String promptTpl = configLoader.getPrompt("map.verification");

        if (promptTpl == null) {
            // Fallback de sécurité
            promptTpl = "Tu es un expert en cohérence géographique. Analyse le texte suivant en te basant STRICTEMENT sur les données de la carte fournies. Relève uniquement les impossibilités de lieux, de distances ou de temps de trajet, sans rien inventer.\n\n[Données de la carte]\n%s\n\n[Texte à analyser]\n%s";
        }

        String finalPrompt = String.format(promptTpl, mapDataString, text);

        return llmOrchestrator.complete(finalPrompt)
                .exceptionally(ex -> {
                    log.error("Échec lors de la vérification géographique.", ex);
                    return "Erreur technique lors de la vérification de la cohérence géographique.";
                });
    }
}
