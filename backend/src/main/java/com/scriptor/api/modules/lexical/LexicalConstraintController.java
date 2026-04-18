package com.scriptor.api.modules.lexical;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST pour l'analyse lexicale (fréquence et contraintes de l'auteur).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/lexicon")
@RequiredArgsConstructor
public class LexicalConstraintController {

    private final LexicalConstraintService lexicalConstraintService;

    @PostMapping("/analyze")
    public CompletableFuture<LexicalAnalysisResponse> analyzeLexicon(@RequestBody LexicalAnalysisRequest request) {
        log.info("Requête REST reçue : /lexicon/analyze");
        return lexicalConstraintService.analyzeLexicon(request);
    }

    @GetMapping("/rules")
    public CompletableFuture<Map<String, List<String>>> getRules() {
        log.info("Requête REST reçue : /lexicon/rules (GET)");
        return CompletableFuture.supplyAsync(lexicalConstraintService::getLexiconRules);
    }

    @PostMapping("/rules")
    public CompletableFuture<Map<String, List<String>>> saveRules(
            @RequestBody Map<String, List<String>> payload
    ) {
        log.info("Requête REST reçue : /lexicon/rules (POST)");
        return CompletableFuture.supplyAsync(() -> lexicalConstraintService.saveLexiconRules(payload));
    }
}
