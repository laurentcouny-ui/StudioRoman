package com.scriptor.api.modules.lexical;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO pour la requête d'analyse des contraintes lexicales.
 */
@Data
public class LexicalAnalysisRequest {
    @NotBlank(message = "text est obligatoire")
    @Size(max = 300_000, message = "text dépasse la taille maximale autorisée")
    private String text;
}
