package com.scriptor.api.modules.annotations;

import lombok.Data;

/**
 * Modèle représentant une annotation textuelle.
 * Conforme à la structure JSON minuscule exigée : {début, fin, tag, timestamp}.
 */
@Data
public class Annotation {
    // Identifiant unique généré pour pouvoir supprimer l'annotation une fois résolue
    private String id;
    
    // Index de début de la sélection
    private int debut;
    
    // Index de fin de la sélection
    private int fin;
    
    // Tag appliqué (ex: "pas satisfait", "à développer", "idée ici")
    private String tag;
    
    // Horodatage de l'annotation
    private long timestamp;
}
