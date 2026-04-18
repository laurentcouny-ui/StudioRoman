package com.scriptor.api.modules.resume;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.modules.style.StyleProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service métier traitant la Fiche de reprise automatique.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeSessionService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final StyleProfileService styleProfileService;

    public CompletableFuture<ResumeSessionResponse> generateResumeSheet(ResumeSessionRequest request) {
        String context = request.getLastContext() == null ? "" : request.getLastContext();
        String tone = request.getTone() == null ? "co_auteur" : request.getTone().toLowerCase();
        
        log.info("Génération de la fiche de reprise. Ton demandé : {}", tone);

        // Bloc 1: Extraction des 3 dernières phrases
        String lastLines = extractLastSentences(context, 3);

        // Récupération des prompts dans le YAML
        String charPromptTpl = configLoader.getPrompt("reprise.personnage");
        String questionPromptTpl = configLoader.getPrompt("reprise.tons." + tone);

        // Sécurisation (Fallback) si le fichier YAML est introuvable
        if (charPromptTpl == null) charPromptTpl = "Analyse cet extrait et identifie le personnage actif et son état émotionnel. Format 'Nom · état'. Extrait : \n%s";
        if (questionPromptTpl == null) questionPromptTpl = "Pose une seule question pour relancer l'auteur sur cet extrait : \n%s";

        // Injection du contexte
        String styleBlock = styleProfileService.styleReferenceBlockForPrompts();
        String finalCharPrompt = String.format(charPromptTpl, lastLines) + styleBlock;
        String finalQuestionPrompt = String.format(questionPromptTpl, lastLines) + styleBlock;

        // Exécution de 2 appels IA EN PARALLÈLE pour réduire drastiquement le temps d'attente
        CompletableFuture<String> charStateFuture = llmOrchestrator.complete(finalCharPrompt)
                .exceptionally(e -> "Personnage inconnu · État indéterminé");

        CompletableFuture<String> aiQuestionFuture = llmOrchestrator.complete(finalQuestionPrompt)
                .exceptionally(e -> "Comment souhaites-tu poursuivre cette scène ?");

        boolean pickChronology = Math.abs(context.hashCode()) % 2 == 0;
        String nextStep = pickChronology
                ? "Consulter la chronologie de l'intrigue (Source : timeline de la saga)"
                : "Approfondir la bible d'univers (Source : fiches bible)";

        // Assemblage final de la Fiche de Reprise lorsque les 2 appels sont terminés
        return charStateFuture.thenCombine(aiQuestionFuture, (charState, aiQuestion) -> 
            new ResumeSessionResponse(
                    lastLines,
                    charState.replace("\"", "").trim(),
                    nextStep,
                    request.getOpenAnnotations() != null ? request.getOpenAnnotations() : List.of(),
                    aiQuestion.replace("\"", "").trim()
            )
        );
    }

    /**
     * Méthode utilitaire découpant le texte aux ponctuations de fin pour isoler les N dernières phrases.
     */
    private String extractLastSentences(String text, int count) {
        if (text == null || text.isBlank()) return "Aucun texte récent identifié.";
        // Expression régulière : découpe sur les points, points d'interrogation et d'exclamation
        String[] sentences = text.split("(?<=[.!?])\\s+");
        int start = Math.max(0, sentences.length - count);
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < sentences.length; i++) {
            sb.append(sentences[i]).append(" ");
        }
        return sb.toString().trim();
    }
}
