package com.scriptor.api.llm;

import com.scriptor.api.security.SecurityManager;
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

@Slf4j
@Service
public class ProviderConfigService {
    private final SecurityManager securityManager;
    private final Path configPath;
    private final Object configWriteLock = new Object();

    public ProviderConfigService(SecurityManager securityManager, @Value("${scriptor.config.dir:./config}") String configDir) {
        this.securityManager = securityManager;
        this.configPath = Paths.get(configDir, "providers.yml");
    }

    @SuppressWarnings("unchecked")
    public String getDecryptedKey(String providerName) {
        try {
            if (!Files.exists(configPath)) return null;
            Yaml yaml = new Yaml();
            try (InputStream in = Files.newInputStream(configPath)) {
                Map<String, Object> data = yaml.load(in);
                if (data == null) return null;
                Map<String, Object> scriptor = (Map<String, Object>) data.get("scriptor");
                if (scriptor == null) return null;
                Map<String, Object> providers = (Map<String, Object>) scriptor.get("providers");
                if (providers == null) return null;
                Map<String, Object> provider = (Map<String, Object>) providers.get(providerName);
                if (provider == null) return null;
                String encrypted = (String) provider.get("encrypted-key");
                return securityManager.decryptApiKey(encrypted);
            }
        } catch (Exception e) {
            log.error("Erreur lecture clé pour {}", providerName, e);
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    public void saveKey(String providerName, String plainKey) {
        synchronized (configWriteLock) {
            try {
                String encrypted = securityManager.encryptApiKey(plainKey);
                Yaml yaml = new Yaml();
                Map<String, Object> data = new HashMap<>();
                if (Files.exists(configPath)) {
                    try (InputStream in = Files.newInputStream(configPath)) {
                        Map<String, Object> loaded = yaml.load(in);
                        if (loaded != null) data = loaded;
                    }
                }
                data.putIfAbsent("scriptor", new HashMap<String, Object>());
                Map<String, Object> scriptor = (Map<String, Object>) data.get("scriptor");
                scriptor.putIfAbsent("providers", new HashMap<String, Object>());
                Map<String, Object> providers = (Map<String, Object>) scriptor.get("providers");
                providers.putIfAbsent(providerName, new HashMap<String, Object>());
                Map<String, Object> provider = (Map<String, Object>) providers.get(providerName);
                provider.put("encrypted-key", encrypted);
                DumperOptions options = new DumperOptions();
                options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
                options.setPrettyFlow(true);
                Yaml writerYaml = new Yaml(options);
                File tempFile = new File(configPath.toAbsolutePath() + ".tmp");
                try (Writer writer = new OutputStreamWriter(Files.newOutputStream(tempFile.toPath()))) {
                    writerYaml.dump(data, writer);
                }
                try {
                    Files.move(
                            tempFile.toPath(),
                            configPath,
                            StandardCopyOption.REPLACE_EXISTING,
                            StandardCopyOption.ATOMIC_MOVE
                    );
                } catch (AtomicMoveNotSupportedException ex) {
                    Files.move(tempFile.toPath(), configPath, StandardCopyOption.REPLACE_EXISTING);
                }
                log.info("Clé API sauvegardée avec succès pour {}", providerName);
            } catch (Exception e) {
                log.error("Erreur sauvegarde clé pour {}", providerName, e);
                throw new RuntimeException("Impossible de sauvegarder la clé API", e);
            }
        }
    }
}
