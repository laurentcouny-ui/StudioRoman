package com.scriptor.api.modules.analysis;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO de la requête pour lancer une analyse narrative.
 */
@Data
public class NarrativeAnalysisRequest {
    @NotBlank(message = "text est obligatoire")
    @Size(max = 300_000, message = "text dépasse la taille maximale autorisée")
    private String text;
}
