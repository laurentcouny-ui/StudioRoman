package com.scriptor.api.llm;

import com.scriptor.api.modules.annotations.Annotation;
import com.scriptor.api.modules.annotations.AnnotationService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service centralisé pour le routage des requêtes IA.
 * Maintient le registre de tous les providers disponibles et gère le fallback.
 */
@Slf4j
@Service
public class LLMOrchestrator {

    private final Map<String, LLMProvider> providers;
    private final LLMSettingsPersistenceService persistence;
    private final AnnotationService annotationService;
    private String activeProviderId;
    private boolean offlineMode = false;
    private boolean silentMode = false;
    private final int maxPromptChars;

    public LLMOrchestrator(
            List<LLMProvider> providerList,
            LLMSettingsPersistenceService persistence,
            AnnotationService annotationService,
            @Value("${scriptor.ia.max-prompt-chars:32000}") int maxPromptChars
    ) {
        // Indexation dynamique de tous les providers implémentant l'interface LLMProvider
        this.providers = providerList.stream()
                .collect(Collectors.toMap(
                        p -> p.getClass().getSimpleName(),
                        Function.identity()
                ));
        this.persistence = persistence;
        this.annotationService = annotationService;
        this.maxPromptChars = Math.max(2000, maxPromptChars);
        // Le modèle gratuit et local est toujours sélectionné par défaut
        this.activeProviderId = "OllamaLocalProvider";
    }

    /** Charge les settings persistés après que Spring a injecté tous les beans. */
    @PostConstruct
    public void loadPersistedSettings() {
        this.offlineMode      = persistence.isOfflineMode();
        this.silentMode       = persistence.isSilentMode();
        String saved = persistence.getActiveProviderId();
        if (providers.containsKey(saved)) {
            this.activeProviderId = saved;
        }
        log.info("LLMOrchestrator initialisé avec {} providers. Actif: {}, offline={}, silent={}",
                providers.size(), activeProviderId, offlineMode, silentMode);
    }

    /**
     * Permet au Frontend de changer le provider actif (via un menu déroulant ou un radio button).
     */
    public void setActiveProvider(String providerId) {
        if (providers.containsKey(providerId)) {
            this.activeProviderId = providerId;
            persistence.save(offlineMode, silentMode, activeProviderId);
            log.info("Provider actif changé pour : {}", providerId);
        } else {
            throw new IllegalArgumentException("Provider inconnu : " + providerId);
        }
    }

    /**
     * Active ou désactive le mode hors-ligne total (Force Ollama local).
     */
    public void setOfflineMode(boolean offlineMode) {
        this.offlineMode = offlineMode;
        persistence.save(offlineMode, silentMode, activeProviderId);
        log.info("Mode hors-ligne total : {}", offlineMode ? "ACTIVÉ" : "DÉSACTIVÉ");
    }

    /**
     * Active ou désactive le mode silencieux (Coupe l'IA temporairement).
     */
    public void setSilentMode(boolean silentMode) {
        this.silentMode = silentMode;
        persistence.save(offlineMode, silentMode, activeProviderId);
        log.info("Mode silencieux : {}", silentMode ? "ACTIVÉ" : "DÉSACTIVÉ");
    }

    public boolean isOfflineMode() { return offlineMode; }
    public boolean isSilentMode() { return silentMode; }
    public String getActiveProviderId() { return activeProviderId; }

    /**
     * Récupère le provider actif. Implémente le Fallback Local-First.
     */
    public LLMProvider getActiveProvider() {
        // Le mode hors-ligne total court-circuite toute sélection utilisateur
        if (offlineMode) {
            return providers.get("OllamaLocalProvider");
        }

        LLMProvider provider = providers.get(activeProviderId);
        
        // Si le provider sélectionné n'est pas disponible (clé supprimée, non valide...),
        // on bascule automatiquement sur Ollama plutôt que de crasher l'application.
        if (provider == null || !provider.isAvailable()) {
            LLMProvider ollama = providers.get("OllamaLocalProvider");
            String relayName = ollama != null ? ollama.getName() : "OllamaLocalProvider (bean absent)";
            log.warn(
                    "Dégradation gracieuse LLMOrchestrator : le provider sélectionné ({}) est indisponible — relais effectif vers {}.",
                    activeProviderId,
                    relayName
            );
            return ollama;
        }
        return provider;
    }

    /**
     * Route la requête 'complete' vers le provider actif.
     */
    public CompletableFuture<String> complete(String prompt) {
        if (silentMode) {
            log.info("Requête ignorée : le mode silencieux est activé.");
            return CompletableFuture.completedFuture("L'IA est en mode silencieux. Vous pouvez la réactiver dans vos paramètres.");
        }
        String enriched = appendOpenAnnotationsIfAbsent(prompt);
        validatePromptSize(enriched);

        LLMProvider provider = getActiveProvider();
        if (provider == null) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucun provider IA n'est disponible."));
        }
        log.debug("Routage de la requête 'complete' vers {}", provider.getName());
        return provider.complete(enriched);
    }

    /**
     * Route la requête 'stream' vers le provider actif.
     */
    public void stream(String prompt, Consumer<String> onToken, Runnable onDone) {
        if (silentMode) {
            onToken.accept("L'IA est en mode silencieux. Vous pouvez la réactiver dans vos paramètres.");
            onDone.run();
            return;
        }
        String enriched = appendOpenAnnotationsIfAbsent(prompt);
        try {
            validatePromptSize(enriched);
        } catch (ResponseStatusException ex) {
            onToken.accept(ex.getReason() != null ? ex.getReason() : "Prompt trop volumineux.");
            onDone.run();
            return;
        }

        LLMProvider provider = getActiveProvider();
        if (provider == null) {
            onToken.accept("[Erreur : Aucun provider IA n'est disponible. L'orchestrateur est défaillant.]");
            onDone.run();
            return;
        }
        log.debug("Routage de la requête 'stream' vers {}", provider.getName());
        provider.stream(enriched, onToken, onDone);
    }

    /**
     * Rappel des annotations ouvertes sur tout appel LLM (CDC §8.3), sans dupliquer si déjà présent.
     */
    private String appendOpenAnnotationsIfAbsent(String prompt) {
        if (prompt == null) {
            return "";
        }
        if (prompt.contains("=== ANNOTATIONS DE L'AUTEUR ===")) {
            return prompt;
        }
        List<Annotation> open = annotationService.getOpenAnnotations();
        if (open == null || open.isEmpty()) {
            return prompt;
        }
        StringBuilder sb = new StringBuilder(prompt);
        sb.append("\n\n=== ANNOTATIONS DE L'AUTEUR ===\n");
        for (Annotation a : open) {
            sb.append("- [").append(a.getTag()).append("] plages de caractères : ")
                    .append(a.getDebut()).append("–").append(a.getFin()).append("\n");
        }
        return sb.toString();
    }

    private void validatePromptSize(String prompt) {
        int length = prompt == null ? 0 : prompt.length();
        if (length <= maxPromptChars) return;
        throw new ResponseStatusException(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Texte trop volumineux pour l'analyse IA (" + length + " caractères). Limite actuelle: " + maxPromptChars + "."
        );
    }
}
