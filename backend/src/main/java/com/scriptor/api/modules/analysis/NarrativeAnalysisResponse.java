package com.scriptor.api.modules.analysis;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO contenant le rapport d'analyse et des métriques pour visualisation (CDC §10).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NarrativeAnalysisResponse {
    private String analysisReport;
    /** Cinq segments 1–10 pour un aperçu graphique de la tension. */
    private List<Integer> intensitySegments;
    private Integer povSwitchCount;
}
