package com.scriptor.api.modules.pageblanche;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.ContextWindowManager;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.modules.annotations.Annotation;
import com.scriptor.api.modules.annotations.AnnotationService;
import com.scriptor.api.modules.style.StyleProfileService;
import com.scriptor.api.modules.universe.UniverseSnippetBuilderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service métier traitant le syndrome de la page blanche.
 * Priorité absolue de la Phase 2.
 * Respecte la règle d'or : "Ne jamais rédiger à la place de l'auteur".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PageBlancheService {

    private final LLMOrchestrator llmOrchestrator;
    private final ContextWindowManager contextWindowManager;
    private final ConfigLoader configLoader;
    private final AnnotationService annotationService;
    private final StyleProfileService styleProfileService;
    private final UniverseSnippetBuilderService universeSnippetBuilderService;

    /**
     * Lance un diagnostic asynchrone pour débloquer l'auteur.
     *
     * @param request Les données de contexte envoyées par l'interface UI.
     * @return Un Future contenant la réponse formatée avec les questions de relance.
     */
    public CompletableFuture<PageBlancheResponse> diagnose(PageBlancheRequest request) {
        String selectedTone = request.getTone() != null ? request.getTone().toLowerCase() : "co_auteur";
        log.info("Diagnostic Page Blanche demandé. Ton sélectionné : {}", selectedTone);

        // 1. Récupération des consignes depuis le fichier prompts.yml
        String systemBase = configLoader.getPrompt("page_blanche.system_base");
        String tonePrompt = configLoader.getPrompt("page_blanche.tons." + selectedTone);

        if (systemBase == null || tonePrompt == null) {
            log.error("Prompts manquants. Ton recherché: {}", selectedTone);
            return CompletableFuture.failedFuture(
                    new IllegalStateException("Configuration des prompts introuvable pour le mode Page Blanche.")
            );
        }

        // Récupération des annotations laissées en suspens par l'auteur
        List<Annotation> openAnnotations = annotationService.getOpenAnnotations();

        // 2. Fenêtre glissante + extraits bible / chronologie synchronisés + annotations (CDC §8.1)
        var snippets = universeSnippetBuilderService.buildRelevantSnippets(
                request.getFullText(),
                request.getCursorPosition()
        );
        String contextPayload = contextWindowManager.buildContextPayload(
                request.getFullText(),
                request.getCursorPosition(),
                snippets,
                openAnnotations
        );

        // 3. Assemblage du super-prompt
        String finalPrompt = systemBase + "\n\n" + tonePrompt + "\n\n" + contextPayload
                + styleProfileService.styleReferenceBlockForPrompts();

        // 4. Appel de l'Intelligence Artificielle de façon totalement asynchrone
        log.debug("Envoi de la requête à l'orchestrateur LLM...");
        return llmOrchestrator.complete(finalPrompt)
                .thenApply(generatedQuestions -> {
                    log.info("Questions de relance générées avec succès.");
                    return new PageBlancheResponse(selectedTone, generatedQuestions);
                })
                .whenComplete((ok, ex) -> {
                    if (ex != null) log.error("Échec lors de la génération des questions pour la page blanche.", ex);
                });
    }
}
