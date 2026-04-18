package com.scriptor.api.modules.characters;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
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
    public CompletableFuture<String> detect(@RequestBody Map<String, String> body) {
        String sceneText = body != null ? body.getOrDefault("sceneText", "") : "";
        return characterDetectionService.detectCharactersInScene(sceneText);
    }
}
