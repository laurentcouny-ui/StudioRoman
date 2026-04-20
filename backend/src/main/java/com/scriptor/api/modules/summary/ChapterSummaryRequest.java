package com.scriptor.api.modules.summary;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO pour la requête de génération d'un résumé de chapitre.
 */
@Data
public class ChapterSummaryRequest {
    // Le texte complet du chapitre
    @NotBlank(message = "chapterText est obligatoire")
    @Size(max = 300_000, message = "chapterText dépasse la taille maximale autorisée")
    private String chapterText;
}
