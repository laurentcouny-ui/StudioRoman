package com.scriptor.api.modules.publisher;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO pour la génération d'un document de soumission éditeur.
 */
@Data
public class PublisherGenerateRequest {
    /** Type de document à générer : lettre | synopsis | noteIntention | bio */
    @NotBlank(message = "documentType est obligatoire")
    @Pattern(regexp = "^(lettre|synopsis|noteIntention|bio)$", message = "documentType invalide")
    private String documentType;

    /** Nom complet de la maison d'édition ciblée */
    @NotBlank(message = "publisherNom est obligatoire")
    @Size(max = 200, message = "publisherNom dépasse la taille maximale autorisée")
    private String publisherNom;

    /** Spécialité / positionnement de l'éditeur (pour contextualiser) */
    @Size(max = 500, message = "publisherSpecialite dépasse la taille maximale autorisée")
    private String publisherSpecialite;

    /** Genres acceptés par l'éditeur (liste séparée par virgules) */
    @Size(max = 300, message = "publisherGenres dépasse la taille maximale autorisée")
    private String publisherGenres;

    /** Longueur attendue du document (ex : "1 page", "1 à 2 pages") */
    @Size(max = 120, message = "documentLongueur dépasse la taille maximale autorisée")
    private String documentLongueur;

    /** Titre de l'œuvre */
    @NotBlank(message = "manuscritTitre est obligatoire")
    @Size(max = 220, message = "manuscritTitre dépasse la taille maximale autorisée")
    private String manuscritTitre;

    /** Genre littéraire de l'œuvre */
    @Size(max = 120, message = "manuscritGenre dépasse la taille maximale autorisée")
    private String manuscritGenre;

    /** Nombre de signes (espaces compris) du manuscrit */
    @Min(value = 0, message = "manuscritSignes doit être >= 0")
    @Max(value = 20_000_000, message = "manuscritSignes dépasse la limite autorisée")
    private int manuscritSignes;

    /** Résumé libre de l'intrigue fourni par l'auteur */
    @NotBlank(message = "manuscritResume est obligatoire")
    @Size(max = 80_000, message = "manuscritResume dépasse la taille maximale autorisée")
    private String manuscritResume;

    /** Nom de l'auteur */
    @NotBlank(message = "auteurNom est obligatoire")
    @Size(max = 180, message = "auteurNom dépasse la taille maximale autorisée")
    private String auteurNom;

    /** Informations brutes sur l'auteur (pour génération de la bio) */
    @Size(max = 20_000, message = "auteurBioRaw dépasse la taille maximale autorisée")
    private String auteurBioRaw;
}
