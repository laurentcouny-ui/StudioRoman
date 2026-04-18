package com.scriptor.api.modules.map;

import lombok.Data;

/**
 * DTO pour la requête de vérification de cohérence géographique.
 */
@Data
public class MapVerificationRequest {
    
    // Le texte du chapitre ou de la scène à analyser
    private String textToVerify;
}
