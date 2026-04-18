package com.scriptor.api.modules.challenges;

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
    private String challengeType;
    
    // Optionnel : l'interface React peut passer des éléments de contexte (ex: un nom de personnage)
    private String contextData;

    // Optionnel : extrait/résumé du texte récent pour enrichir certains défis.
    private String recentText;
}
