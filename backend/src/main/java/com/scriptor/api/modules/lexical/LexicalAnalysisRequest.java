package com.scriptor.api.modules.lexical;

import lombok.Data;

/**
 * DTO pour la requête d'analyse des contraintes lexicales.
 */
@Data
public class LexicalAnalysisRequest {
    private String text;
}
