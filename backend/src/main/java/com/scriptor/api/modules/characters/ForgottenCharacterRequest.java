package com.scriptor.api.modules.characters;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO pour la requête de détection des personnages oubliés.
 */
@Data
public class ForgottenCharacterRequest {
    // Le texte combiné des X derniers chapitres pour analyse
    @NotBlank(message = "recentText est obligatoire")
    @Size(max = 300_000, message = "recentText dépasse la taille maximale autorisée")
    private String recentText;
    /** Indication libre (ex. « derniers trois chapitres ») pour cadrer l’analyse CDC §11. */
    @Size(max = 120, message = "scopeHint dépasse la taille maximale autorisée")
    private String scopeHint;
}
