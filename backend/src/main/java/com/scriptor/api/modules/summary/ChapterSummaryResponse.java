package com.scriptor.api.modules.summary;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * DTO de réponse contenant le résumé généré par l'IA.
 */
@Data
@AllArgsConstructor
public class ChapterSummaryResponse {
    
    // Le résumé structuré (style fiche de bible)
    private String summary;
}
