package com.scriptor.api.modules.analysis;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.modules.characters.ForgottenCharacterRequest;
import com.scriptor.api.modules.characters.ForgottenCharacterService;
import com.scriptor.api.modules.style.StyleProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class EndBookReviewService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final ForgottenCharacterService forgottenCharacterService;
    private final StyleProfileService styleProfileService;

    public CompletableFuture<EndBookReviewResponse> generateReview(EndBookReviewRequest request) {
        log.info("Bilan de fin de tome demandé.");
        
        String promptTpl = configLoader.getPrompt("review.end_book");
        if (promptTpl == null) {
            promptTpl = "Fais un bilan critique de ce tome avec 3 questions sur les arcs et incohérences :\n\n%s";
        }
        String finalPrompt = String.format(promptTpl, request.getFullText() == null ? "" : request.getFullText())
                + styleProfileService.styleReferenceBlockForPrompts();

        CompletableFuture<String> reviewFuture = llmOrchestrator.complete(finalPrompt)
                .exceptionally(ex -> "Erreur lors de la génération du bilan.");

        ForgottenCharacterRequest forgottenReq = new ForgottenCharacterRequest();
        forgottenReq.setRecentText(request.getFullText() == null ? "" : request.getFullText());
        CompletableFuture<String> forgottenFuture = forgottenCharacterService
                .detectForgottenCharacters(forgottenReq)
                .thenApply(r -> r != null ? r.getForgottenCharacters() : "")
                .exceptionally(ex -> "Analyse des personnages absents indisponible.");

        return reviewFuture.thenCombine(forgottenFuture, EndBookReviewResponse::new)
                .whenComplete((ok, ex) -> {
                    if (ex != null) log.error("Échec du bilan de fin de tome.", ex);
                });
    }
}
