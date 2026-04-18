package com.scriptor.api.modules.map;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST pour le module Géographique.
 * Expose la vérification de cohérence au Frontend React.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/map")
@RequiredArgsConstructor
public class MapController {

    private final MapService mapService;

    @GetMapping("/data")
    public CompletableFuture<com.fasterxml.jackson.databind.JsonNode> getMapData() {
        return CompletableFuture.supplyAsync(mapService::getMapData);
    }

    @PostMapping("/data")
    public CompletableFuture<Void> saveMapData(@RequestBody com.fasterxml.jackson.databind.JsonNode data) {
        return CompletableFuture.runAsync(() -> mapService.saveMapData(data));
    }

    /**
     * Recherche textuelle dans les données carte (lecture seule, sources explicites).
     */
    @GetMapping("/search")
    public CompletableFuture<Map<String, String>> searchMap(@RequestParam String keyword) {
        log.info("Requête REST reçue : GET /map/search (mot-clé: {})", keyword);
        return CompletableFuture.supplyAsync(() -> Map.of(
                "keyword", keyword == null ? "" : keyword,
                "result", mapService.searchMapData(keyword)
        ));
    }

    /**
     * Endpoint permettant à l'auteur de vérifier manuellement 
     * s'il y a des incohérences géographiques dans sa scène.
     * 
     * @param request Le texte à analyser.
     * @return Un futur contenant le rapport de l'IA.
     */
    @PostMapping("/verify")
    public CompletableFuture<Map<String, String>> verifyConsistency(@RequestBody MapVerificationRequest request) {
        log.info("Requête REST reçue : /map/verify");
        
        return mapService.verifyConsistency(request.getTextToVerify())
                .thenApply(result -> Map.of("report", result));
    }
}
