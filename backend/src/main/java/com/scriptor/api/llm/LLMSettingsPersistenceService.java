package com.scriptor.api.llm;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

import java.io.*;
import java.nio.file.*;
import java.nio.file.AtomicMoveNotSupportedException;
import java.util.HashMap;
import java.util.Map;

/**
 * Persiste les paramètres globaux de l'IA (provider actif, modes hors-ligne / silencieux)
 * dans config/ia-settings.yml, de sorte qu'ils survivent aux redémarrages du backend.
 */
@Slf4j
@Service
public class LLMSettingsPersistenceService {

    private final Path settingsPath;
    private final Object writeLock = new Object();

    // Valeurs chargées au démarrage — lues par LLMOrchestrator via les getters.
    @Getter private boolean offlineMode = false;
    @Getter private boolean silentMode  = false;
    @Getter private String  activeProviderId = "OllamaLocalProvider";
    @Getter private String  ollamaModel = "";

    public LLMSettingsPersistenceService(
            @Value("${scriptor.config.dir:./config}") String configDir) {
        this.settingsPath = Paths.get(configDir, "ia-settings.yml");
    }

    @PostConstruct
    public void load() {
        if (!Files.exists(settingsPath)) {
            log.info("Fichier ia-settings.yml absent, paramètres IA par défaut utilisés.");
            return;
        }
        try {
            Yaml yaml = new Yaml();
            try (InputStream in = Files.newInputStream(settingsPath)) {
                Map<?, ?> data = yaml.load(in);
                if (data == null) return;
                Object om = data.get("offlineMode");
                Object sm = data.get("silentMode");
                Object ap = data.get("activeProviderId");
                if (om instanceof Boolean b)  offlineMode      = b;
                if (sm instanceof Boolean b)  silentMode       = b;
                if (ap instanceof String  s && !s.isBlank()) activeProviderId = s;
                Object om2 = data.get("ollamaModel");
                if (om2 instanceof String s && !s.isBlank()) ollamaModel = s;
                log.info("Paramètres IA chargés : provider={}, ollamaModel={}, offline={}, silent={}",
                        activeProviderId, ollamaModel, offlineMode, silentMode);
            }
        } catch (Exception e) {
            log.warn("Impossible de lire ia-settings.yml, paramètres par défaut utilisés.", e);
        }
    }

    public void saveOllamaModel(String model) {
        this.ollamaModel = model;
        save(offlineMode, silentMode, activeProviderId);
    }

    public void save(boolean offlineMode, boolean silentMode, String activeProviderId) {
        this.offlineMode = offlineMode;
        this.silentMode = silentMode;
        this.activeProviderId = activeProviderId;
        synchronized (writeLock) {
            try {
                Map<String, Object> data = new HashMap<>();
                data.put("offlineMode",      offlineMode);
                data.put("silentMode",       silentMode);
                data.put("activeProviderId", activeProviderId);
                if (!ollamaModel.isBlank()) data.put("ollamaModel", ollamaModel);

                DumperOptions opts = new DumperOptions();
                opts.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
                opts.setPrettyFlow(true);
                Yaml yaml = new Yaml(opts);

                Path tmp = Path.of(settingsPath.toAbsolutePath() + ".tmp");
                try (Writer w = new OutputStreamWriter(Files.newOutputStream(tmp))) {
                    yaml.dump(data, w);
                }
                try {
                    Files.move(tmp, settingsPath,
                            StandardCopyOption.REPLACE_EXISTING,
                            StandardCopyOption.ATOMIC_MOVE);
                } catch (AtomicMoveNotSupportedException ex) {
                    Files.move(tmp, settingsPath, StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (Exception e) {
                log.error("Erreur lors de la sauvegarde de ia-settings.yml", e);
            }
        }
    }
}
