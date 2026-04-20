package com.scriptor.api.modules.bible;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST exposant la recherche dans la Bible de l'auteur au Frontend React.
 * Fait partie du module anti-hallucination.
 */
@Slf4j
@RestController
@Validated
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
    public CompletableFuture<Map<String, String>> searchBible(
            @RequestParam @NotBlank(message = "keyword est obligatoire")
            @Size(max = 120, message = "keyword dépasse la taille maximale autorisée")
            String keyword
    ) {
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
    public CompletableFuture<Map<String, Object>> proposeEntry(@Valid @RequestBody BibleProposalRequest body) {
        if (body.contenu().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contenu est obligatoire");
        }
        return CompletableFuture.supplyAsync(() -> {
            String contenu = body.contenu();
            String section = body.section() == null || body.section().isBlank()
                    ? "Résumé de chapitre"
                    : body.section().trim();
            BibleEntity saved = biblePropositionService.appendProposedSummary(contenu, section);
            return Map.of(
                    "id", saved.getId(),
                    "fiche", saved.getFiche(),
                    "section", saved.getSection(),
                    "paragraphe", saved.getParagraphe()
            );
        });
    }

    public record BibleProposalRequest(
            @NotBlank(message = "contenu est obligatoire")
            @Size(max = 80_000, message = "contenu dépasse la taille maximale autorisée")
            String contenu,
            @Size(max = 180, message = "section dépasse la taille maximale autorisée")
            String section
    ) {}
}
