package com.scriptor.api.modules.pageblanche;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO (Data Transfer Object) représentant la requête envoyée par le Frontend (React)
 * lorsqu'un auteur clique sur le bouton "Page Blanche".
 */
@Data
public class PageBlancheRequest {
    // Le texte complet du chapitre ou de la scène en cours
    @NotBlank(message = "fullText est obligatoire")
    @Size(max = 300_000, message = "fullText dépasse la taille maximale autorisée")
    private String fullText;
    
    // La position exacte du curseur de l'auteur
    @Min(value = 0, message = "cursorPosition doit être >= 0")
    @Max(value = 1_000_000, message = "cursorPosition dépasse la limite autorisée")
    private int cursorPosition;
    
    // Le ton sélectionné dans le panneau IA : "co_auteur", "editeur", ou "lecteur"
    @NotBlank(message = "tone est obligatoire")
    @Pattern(regexp = "^(co_auteur|editeur|lecteur)$", message = "tone invalide")
    private String tone;
}
