package com.scriptor.api.modules.style;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST exposant la gestion du profil de ton narratif.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/style")
@RequiredArgsConstructor
public class StyleProfileController {

    private final StyleProfileService styleProfileService;

    @GetMapping
    public CompletableFuture<StyleProfile> getProfile() {
        log.info("Requête REST reçue : GET /style");
        return CompletableFuture.supplyAsync(styleProfileService::getProfile);
    }

    @PostMapping
    public CompletableFuture<StyleProfile> saveProfile(@RequestBody StyleProfile profile) {
        log.info("Requête REST reçue : POST /style");
        return CompletableFuture.supplyAsync(() -> styleProfileService.saveProfile(profile));
    }

    @PostMapping("/analyze")
    public CompletableFuture<StyleProfile> analyzeStyle() {
        log.info("Requête REST reçue : POST /style/analyze");
        return styleProfileService.analyzeStyle();
    }
}
