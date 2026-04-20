package com.scriptor.api.modules.characters;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Recherche dans les fiches personnages (réponses issues des données locales uniquement).
 */
@Slf4j
@RestController
@Validated
@RequestMapping("/api/v1/ia/characters")
@RequiredArgsConstructor
public class CharacterCatalogController {

    private final CharacterCatalogService characterCatalogService;

    @GetMapping("/search")
    public CompletableFuture<Map<String, String>> searchCharacters(
            @RequestParam @NotBlank(message = "keyword est obligatoire")
            @Size(max = 120, message = "keyword dépasse la taille maximale autorisée")
            String keyword
    ) {
        log.info("Requête REST reçue : GET /characters/search (mot-clé: {})", keyword);
        return CompletableFuture.supplyAsync(() -> {
            String result = characterCatalogService.queryCharacters(keyword);
            return Map.of("keyword", keyword, "result", result);
        });
    }
}
