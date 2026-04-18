package com.scriptor.api.modules.style;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.CompletableFuture;

/**
 * Service gérant le profil de ton narratif (lecture des extraits et synthèse IA).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StyleProfileService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final ObjectMapper objectMapper;

    @Value("${scriptor.data.dir:./config/data}")
    private String dataDir;

    private File getProfileFile() {
        return Paths.get(dataDir, "style-profiles.json").toFile();
    }

    /**
     * Récupère le profil stylistique actuel.
     */
    public StyleProfile getProfile() {
        File file = getProfileFile();
        if (file.exists()) {
            try {
                return objectMapper.readValue(file, StyleProfile.class);
            } catch (Exception e) {
                log.error("Erreur de lecture de style-profiles.json", e);
            }
        }
        return new StyleProfile();
    }

    /**
     * Suffixe optionnel injecté dans les prompts de suggestion pour aligner le ton sur le profil de l'auteur (CDC Phase 4).
     */
    public String styleReferenceBlockForPrompts() {
        String r = getProfile().getAnalysisReport();
        if (r == null || r.isBlank()) {
            return "";
        }
        return "\n\n--- Référence de ton narratif (profil de l'auteur) ---\n" + r.trim() + "\n";
    }

    /**
     * Sauvegarde le profil (notamment lorsque l'auteur ajoute ou retire un extrait).
     */
    public StyleProfile saveProfile(StyleProfile profile) {
        try {
            File file = getProfileFile();
            if (!file.getParentFile().exists()) file.getParentFile().mkdirs();
            File tempFile = new File(file.getAbsolutePath() + ".tmp");
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tempFile, profile);
            try {
                Files.move(
                        tempFile.toPath(),
                        file.toPath(),
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE
                );
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(tempFile.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            log.info("Profil de ton narratif mis à jour. ({} extraits)", profile.getExtraits().size());
        } catch (Exception e) {
            log.error("Erreur lors de la sauvegarde du profil stylistique", e);
            throw new RuntimeException("Échec de sauvegarde du profil stylistique.", e);
        }
        return profile;
    }

    /**
     * Lance l'analyse IA des extraits stockés pour générer la synthèse stylistique.
     */
    public CompletableFuture<StyleProfile> analyzeStyle() {
        StyleProfile profile = getProfile();
        if (profile.getExtraits() == null || profile.getExtraits().isEmpty()) {
            return CompletableFuture.completedFuture(profile);
        }

        String extractsText = String.join("\n\n---\n\n", profile.getExtraits());
        String promptTpl = configLoader.getPrompt("style_profile.analysis");
        if (promptTpl == null) promptTpl = "Analyse le style des extraits suivants :\n%s";

        String finalPrompt = String.format(promptTpl, extractsText);

        return llmOrchestrator.complete(finalPrompt).thenApply(analysis -> {
            profile.setAnalysisReport(analysis.trim());
            saveProfile(profile);
            return profile;
        });
    }
}
