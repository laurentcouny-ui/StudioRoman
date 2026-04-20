package com.scriptor.api.modules.resume;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.List;

/**
 * DTO de requête pour la génération de la fiche de reprise.
 */
@Data
public class ResumeSessionRequest {
    // Le texte complet ou la fin de la session précédente
    @NotBlank(message = "lastContext est obligatoire")
    @Size(max = 300_000, message = "lastContext dépasse la taille maximale autorisée")
    private String lastContext;
    
    // Les annotations (tags) laissées ouvertes par l'auteur
    @Size(max = 200, message = "openAnnotations dépasse le nombre maximal autorisé")
    private List<String> openAnnotations;
    
    // Le ton sélectionné pour la question de l'IA (co_auteur, editeur, lecteur)
    @NotBlank(message = "tone est obligatoire")
    @Pattern(regexp = "^(co_auteur|editeur|lecteur)$", message = "tone invalide")
    private String tone;
}
