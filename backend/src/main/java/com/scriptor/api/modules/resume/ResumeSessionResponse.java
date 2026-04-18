package com.scriptor.api.modules.resume;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

/**
 * DTO contenant les 5 blocs stricts de la fiche de reprise automatique.
 */
@Data
@AllArgsConstructor
public class ResumeSessionResponse {
    // Bloc 1: Les 3 dernières phrases écrites
    private String lastLines;
    // Bloc 2: Personnage actif et son état (ex: "Aldric · sous tension")
    private String activeCharacterState;
    // Bloc 3: Prochaine étape (Source affichée pour l'auteur)
    private String nextStep;
    // Bloc 4: Annotations ouvertes
    private List<String> openAnnotations;
    // Bloc 5: Question IA de relance
    private String aiQuestion;
}
