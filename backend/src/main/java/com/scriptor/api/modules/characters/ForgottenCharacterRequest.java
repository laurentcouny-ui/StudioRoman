package com.scriptor.api.modules.characters;

import lombok.Data;

/**
 * DTO pour la requête de détection des personnages oubliés.
 */
@Data
public class ForgottenCharacterRequest {
    // Le texte combiné des X derniers chapitres pour analyse
    private String recentText;
    /** Indication libre (ex. « derniers trois chapitres ») pour cadrer l’analyse CDC §11. */
    private String scopeHint;
}
