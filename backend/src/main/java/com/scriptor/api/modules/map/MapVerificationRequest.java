package com.scriptor.api.modules.map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO pour la requête de vérification de cohérence géographique.
 */
@Data
public class MapVerificationRequest {
    
    // Le texte du chapitre ou de la scène à analyser
    @NotBlank(message = "textToVerify est obligatoire")
    @Size(max = 300_000, message = "textToVerify dépasse la taille maximale autorisée")
    private String textToVerify;
}
