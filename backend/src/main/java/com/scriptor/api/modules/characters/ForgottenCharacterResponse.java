package com.scriptor.api.modules.characters;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * DTO de réponse listant les personnages oubliés.
 */
@Data
@AllArgsConstructor
public class ForgottenCharacterResponse {
    // Liste des personnages oubliés (formatée par l'IA)
    private String forgottenCharacters;
}
