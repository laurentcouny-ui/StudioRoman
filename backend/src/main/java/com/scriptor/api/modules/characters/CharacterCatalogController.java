package com.scriptor.api.modules.characters;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Recherche dans les fiches personnages (réponses issues des données locales uniquement).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/characters")
@RequiredArgsConstructor
public class CharacterCatalogController {

    private final CharacterCatalogService characterCatalogService;

    @GetMapping("/search")
    public CompletableFuture<Map<String, String>> searchCharacters(@RequestParam String keyword) {
        log.info("Requête REST reçue : GET /characters/search (mot-clé: {})", keyword);
        return CompletableFuture.supplyAsync(() -> {
            String result = characterCatalogService.queryCharacters(keyword);
            return Map.of("keyword", keyword == null ? "" : keyword, "result", result);
        });
    }
}
