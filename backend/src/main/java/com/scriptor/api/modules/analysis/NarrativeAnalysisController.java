package com.scriptor.api.modules.analysis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST pour l'analyse du rythme narratif.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/analysis")
@RequiredArgsConstructor
public class NarrativeAnalysisController {

    private final NarrativeAnalysisService narrativeAnalysisService;

    @PostMapping("/narrative")
    public CompletableFuture<NarrativeAnalysisResponse> analyzeNarrative(@RequestBody NarrativeAnalysisRequest request) {
        log.info("Requête REST reçue : /analysis/narrative");
        return narrativeAnalysisService.analyzeNarrative(request);
    }
}
