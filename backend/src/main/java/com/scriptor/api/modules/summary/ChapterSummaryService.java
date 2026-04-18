package com.scriptor.api.modules.summary;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.modules.style.StyleProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Service de génération de résumés de chapitres.
 * Déclenché lors d'une sauvegarde pour alimenter la bible.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChapterSummaryService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final StyleProfileService styleProfileService;

    /**
     * Génère un résumé asynchrone pour le chapitre fourni.
     */
    public CompletableFuture<ChapterSummaryResponse> generateSummary(ChapterSummaryRequest request) {
        log.info("Génération du résumé de chapitre demandée. (Taille: {} caractères)", 
                request.getChapterText() != null ? request.getChapterText().length() : 0);

        String promptTpl = configLoader.getPrompt("summary.chapter");

        // Fallback de sécurité si le YAML est temporairement indisponible
        if (promptTpl == null) {
            promptTpl = "Résume le chapitre suivant de manière concise, dans le style d'une fiche de bible (événements majeurs, lieux, personnages).\n\n[Texte du chapitre]\n%s";
        }

        String finalPrompt = String.format(promptTpl, request.getChapterText() == null ? "" : request.getChapterText())
                + styleProfileService.styleReferenceBlockForPrompts();

        return llmOrchestrator.complete(finalPrompt)
                .thenApply(summary -> {
                    log.info("Résumé de chapitre généré avec succès.");
                    return new ChapterSummaryResponse(summary);
                })
                .whenComplete((ok, ex) -> {
                    if (ex != null) log.error("Échec de la génération du résumé de chapitre.", ex);
                });
    }
}
