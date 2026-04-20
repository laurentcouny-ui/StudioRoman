package com.scriptor.api.modules.characters;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Détection des personnages présents dans une scène (liste autorisée + LLM).
 * Déclenchée côté client sur sauvegarde explicite (ex. Ctrl+S), jamais en temps réel.
 */
@RestController
@RequestMapping("/api/v1/ia/characters/detect")
@RequiredArgsConstructor
public class CharacterDetectionController {

    private final CharacterDetectionService characterDetectionService;

    /**
     * Corps JSON : {@code { "sceneText": "..." } } — le texte peut être brut ou HTML (nettoyé côté client).
     */
    @PostMapping(consumes = "application/json", produces = "text/plain;charset=UTF-8")
    public CompletableFuture<String> detect(@Valid @RequestBody CharacterDetectionRequest body) {
        return characterDetectionService.detectCharactersInScene(body.sceneText());
    }

    public record CharacterDetectionRequest(
            @NotBlank(message = "sceneText est obligatoire")
            @Size(max = 300_000, message = "sceneText dépasse la taille maximale autorisée")
            String sceneText
    ) {}
}
