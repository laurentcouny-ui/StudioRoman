package com.scriptor.api.modules.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.modules.style.StyleProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service analysant le rythme narratif (courbe d'action, longueur des scènes, POV).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NarrativeAnalysisService {

    private static final String METRICS_PREFIX = "SCRIPTOR_METRICS_JSON:";

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final StyleProfileService styleProfileService;
    private final ObjectMapper objectMapper;

    public CompletableFuture<NarrativeAnalysisResponse> analyzeNarrative(NarrativeAnalysisRequest request) {
        log.info("Analyse du rythme narratif demandée. (Taille: {} caractères)",
                request.getText() != null ? request.getText().length() : 0);

        String promptTpl = configLoader.getPrompt("analysis.narrative");

        if (promptTpl == null) {
            promptTpl = "Analyse le rythme narratif du texte suivant (courbe d'action, longueur des scènes, changements de POV) :\n\n%s";
        }

        String finalPrompt = String.format(promptTpl, request.getText() == null ? "" : request.getText())
                + styleProfileService.styleReferenceBlockForPrompts();

        return llmOrchestrator.complete(finalPrompt)
                .thenApply(this::parseAnalysisResponse)
                .whenComplete((ok, ex) -> {
                    if (ex != null) log.error("Échec de l'analyse narrative.", ex);
                });
    }

    private NarrativeAnalysisResponse parseAnalysisResponse(String raw) {
        if (raw == null) {
            return new NarrativeAnalysisResponse("", null, null);
        }
        int idx = raw.lastIndexOf(METRICS_PREFIX);
        if (idx < 0) {
            return new NarrativeAnalysisResponse(raw.trim(), null, null);
        }
        String body = raw.substring(0, idx).trim();
        String jsonPart = raw.substring(idx + METRICS_PREFIX.length()).trim();
        try {
            JsonNode n = objectMapper.readTree(jsonPart);
            List<Integer> segs = new ArrayList<>();
            if (n.has("intensitySegments") && n.get("intensitySegments").isArray()) {
                for (JsonNode x : n.get("intensitySegments")) {
                    segs.add(Math.max(1, Math.min(10, x.asInt(5))));
                }
            }
            while (segs.size() < 5) {
                segs.add(5);
            }
            if (segs.size() > 5) {
                segs = segs.subList(0, 5);
            }
            Integer pov = n.has("povSwitchCount") ? n.get("povSwitchCount").asInt() : null;
            log.info("Analyse narrative générée avec succès.");
            return new NarrativeAnalysisResponse(body, segs, pov);
        } catch (Exception e) {
            log.warn("Métriques SCRIPTOR_METRICS_JSON non parsées, rapport brut conservé.", e);
            return new NarrativeAnalysisResponse(raw.trim(), null, null);
        }
    }
}
