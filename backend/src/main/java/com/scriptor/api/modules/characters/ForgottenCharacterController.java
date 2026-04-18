package com.scriptor.api.modules.characters;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Endpoint à la demande pour repérer les personnages absents des derniers chapitres.
 * Aucune exécution automatique pendant l'écriture.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/characters/forgotten")
@RequiredArgsConstructor
public class ForgottenCharacterController {

    private final ForgottenCharacterService forgottenCharacterService;

    @PostMapping
    public CompletableFuture<ForgottenCharacterResponse> detectForgotten(
            @RequestBody ForgottenCharacterRequest request
    ) {
        String text = request != null ? request.getRecentText() : null;
        log.info("Requête REST reçue : /characters/forgotten (taille texte={})",
                text == null ? 0 : text.length());
        ForgottenCharacterRequest safe = new ForgottenCharacterRequest();
        safe.setRecentText(text == null ? "" : text);
        return forgottenCharacterService.detectForgottenCharacters(safe);
    }
}
