package com.scriptor.api.modules.analysis;

import lombok.Data;

/**
 * DTO de la requête pour lancer une analyse narrative.
 */
@Data
public class NarrativeAnalysisRequest {
    private String text;
}
