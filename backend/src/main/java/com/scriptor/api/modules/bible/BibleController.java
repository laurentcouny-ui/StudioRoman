package com.scriptor.api.modules.bible;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST exposant la recherche dans la Bible de l'auteur au Frontend React.
 * Fait partie du module anti-hallucination.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/bible")
@RequiredArgsConstructor
public class BibleController {

    private final BibleReaderService bibleReaderService;
    private final BiblePropositionService biblePropositionService;

    /**
     * Endpoint permettant de rechercher un élément dans la bible (Anti-hallucination).
     *
     * @param keyword Le mot-clé, concept ou nom de personnage recherché.
     * @return Un futur contenant la réponse formatée (avec sources) ou un refus d'halluciner.
     */
    @GetMapping("/search")
    public CompletableFuture<Map<String, String>> searchBible(@RequestParam String keyword) {
        log.info("Requête REST reçue : /search (Mot-clé recherché: {})", keyword);
        
        return CompletableFuture.supplyAsync(() -> {
            String result = bibleReaderService.queryBible(keyword);
            return Map.of("keyword", keyword, "result", result);
        });
    }

    /**
     * Ajoute une proposition de texte dans la fiche réservée (acceptation manuelle côté auteur / synchro).
     */
    @PostMapping("/propose-entry")
    public CompletableFuture<Map<String, Object>> proposeEntry(@RequestBody Map<String, String> body) {
        return CompletableFuture.supplyAsync(() -> {
            String contenu = body != null ? body.getOrDefault("contenu", "") : "";
            String section = body != null ? body.getOrDefault("section", "Résumé de chapitre") : "Résumé de chapitre";
            BibleEntity saved = biblePropositionService.appendProposedSummary(contenu, section);
            return Map.of(
                    "id", saved.getId(),
                    "fiche", saved.getFiche(),
                    "section", saved.getSection(),
                    "paragraphe", saved.getParagraphe()
            );
        });
    }
}
