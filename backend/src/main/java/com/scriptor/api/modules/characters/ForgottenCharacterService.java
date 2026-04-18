package com.scriptor.api.modules.characters;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service analysant les derniers chapitres pour détecter les personnages absents.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForgottenCharacterService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final CharacterRepository characterRepository;

    public CompletableFuture<ForgottenCharacterResponse> detectForgottenCharacters(ForgottenCharacterRequest request) {
        log.info("Détection des personnages oubliés demandée. (Taille du texte : {})", 
                request.getRecentText() != null ? request.getRecentText().length() : 0);

        List<String> knownCharacters = getKnownCharacters();
        if (knownCharacters.isEmpty()) {
            return CompletableFuture.completedFuture(
                    new ForgottenCharacterResponse("Aucun personnage enregistré dans l'univers.")
            );
        }
        
        String knownCharsString = String.join(", ", knownCharacters);
        String promptTpl = configLoader.getPrompt("personnages.oublies");
        
        if (promptTpl == null) {
            promptTpl = "Voici la liste des personnages de l'univers : %s. Identifie UNIQUEMENT ceux qui n'apparaissent pas dans le texte suivant. Ne réponds que par leurs noms.\n\n[Texte]\n%s";
        }

        String text = request.getRecentText() == null ? "" : request.getRecentText();
        if (request.getScopeHint() != null && !request.getScopeHint().isBlank()) {
            text = "[Périmètre indiqué par l'auteur : " + request.getScopeHint().trim() + "]\n\n" + text;
        }
        String finalPrompt = String.format(promptTpl, knownCharsString, text);

        return llmOrchestrator.complete(finalPrompt)
                .thenApply(result -> {
                    log.info("Analyse des personnages oubliés terminée avec succès.");
                    return new ForgottenCharacterResponse(result != null ? result.trim() : "");
                })
                .whenComplete((ok, ex) -> {
                    if (ex != null) log.error("Échec de la détection des personnages oubliés.", ex);
                });
    }

    private List<String> getKnownCharacters() {
        return characterRepository.findAll().stream()
                .map(CharacterEntity::getNom)
                .filter(nom -> nom != null && !nom.isBlank())
                .toList();
    }
}
