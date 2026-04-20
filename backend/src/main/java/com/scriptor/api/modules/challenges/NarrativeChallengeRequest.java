package com.scriptor.api.modules.challenges;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO de requête pour générer un défi narratif.
 */
@Data
public class NarrativeChallengeRequest {
    
    /**
     * Le type de défi souhaité. 
     * Valeurs possibles : "personnage_oublie", "lacune_bible", "style", "express".
     */
    @NotBlank(message = "challengeType est obligatoire")
    @Pattern(regexp = "^(personnage_oublie|lacune_bible|style|express)$", message = "challengeType invalide")
    private String challengeType;
    
    // Optionnel : l'interface React peut passer des éléments de contexte (ex: un nom de personnage)
    @Size(max = 10_000, message = "contextData dépasse la taille maximale autorisée")
    private String contextData;

    // Optionnel : extrait/résumé du texte récent pour enrichir certains défis.
    @Size(max = 300_000, message = "recentText dépasse la taille maximale autorisée")
    private String recentText;
}
