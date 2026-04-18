package com.scriptor.api.modules.resume;

import lombok.Data;
import java.util.List;

/**
 * DTO de requête pour la génération de la fiche de reprise.
 */
@Data
public class ResumeSessionRequest {
    // Le texte complet ou la fin de la session précédente
    private String lastContext;
    
    // Les annotations (tags) laissées ouvertes par l'auteur
    private List<String> openAnnotations;
    
    // Le ton sélectionné pour la question de l'IA (co_auteur, editeur, lecteur)
    private String tone;
}
