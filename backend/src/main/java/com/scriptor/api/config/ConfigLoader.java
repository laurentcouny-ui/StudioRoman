package com.scriptor.api.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service responsable du chargement dynamique de la configuration hors-code.
 * Lit les fichiers .yml (notamment les prompts) depuis un répertoire externe
 * pour permettre leur modification sans recompilation de l'application Java.
 */
@Slf4j
@Service
public class ConfigLoader {

    @Value("${scriptor.config.dir:./config}")
    private String configDir;

    // Cache thread-safe pour stocker l'arborescence des prompts
    private volatile Map<String, Object> promptsCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        reloadPrompts();
    }

    /**
     * Charge ou recharge le fichier prompts.yml.
     * Peut être appelé à chaud pour appliquer les modifications instantanément.
     */
    public void reloadPrompts() {
        Path promptsPath = Paths.get(configDir, "prompts.yml");
        Yaml yaml = new Yaml();

        try {
            if (Files.exists(promptsPath)) {
                try (InputStream inputStream = Files.newInputStream(promptsPath)) {
                    Map<String, Object> loaded = yaml.load(inputStream);
                    promptsCache = loaded != null ? new ConcurrentHashMap<>(loaded) : new ConcurrentHashMap<>();
                    log.info("Prompts chargés avec succès depuis : {}", promptsPath.toAbsolutePath());
                }
            } else {
                log.warn("Fichier introuvable : {}. Les prompts LLM ne sont pas configurés.", promptsPath.toAbsolutePath());
                promptsCache = new ConcurrentHashMap<>();
            }
        } catch (Exception e) {
            log.error("Erreur critique lors du parsing de {}.", promptsPath.toAbsolutePath(), e);
        }
    }

    /**
     * Récupère un prompt en naviguant dans l'arborescence YAML via une clé formatée.
     *
     * @param key Le chemin du prompt (ex: "syndrome_page_blanche.ton_editeur")
     * @return Le texte du prompt, ou null s'il n'est pas trouvé.
     */
    @SuppressWarnings("unchecked")
    public String getPrompt(String key) {
        String[] keys = key.split("\\.");
        Map<String, Object> currentMap = promptsCache;

        for (int i = 0; i < keys.length - 1; i++) {
            Object value = currentMap.getOrDefault(keys[i], Collections.emptyMap());
            if (value instanceof Map) {
                currentMap = (Map<String, Object>) value;
            } else {
                return null;
            }
        }
        Object finalValue = currentMap.get(keys[keys.length - 1]);
        return finalValue != null ? finalValue.toString() : null;
    }
}
