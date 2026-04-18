package com.scriptor.api.modules.summary;

import lombok.Data;

/**
 * DTO pour la requête de génération d'un résumé de chapitre.
 */
@Data
public class ChapterSummaryRequest {
    // Le texte complet du chapitre
    private String chapterText;
}
