package com.scriptor.api.modules.pageblanche;

import lombok.Data;

/**
 * DTO (Data Transfer Object) représentant la requête envoyée par le Frontend (React)
 * lorsqu'un auteur clique sur le bouton "Page Blanche".
 */
@Data
public class PageBlancheRequest {
    // Le texte complet du chapitre ou de la scène en cours
    private String fullText;
    
    // La position exacte du curseur de l'auteur
    private int cursorPosition;
    
    // Le ton sélectionné dans le panneau IA : "co_auteur", "editeur", ou "lecteur"
    private String tone;
}
