package com.scriptor.api.modules.publisher;

import lombok.Data;

/**
 * DTO pour la génération d'un document de soumission éditeur.
 */
@Data
public class PublisherGenerateRequest {
    /** Type de document à générer : lettre | synopsis | noteIntention | bio */
    private String documentType;

    /** Nom complet de la maison d'édition ciblée */
    private String publisherNom;

    /** Spécialité / positionnement de l'éditeur (pour contextualiser) */
    private String publisherSpecialite;

    /** Genres acceptés par l'éditeur (liste séparée par virgules) */
    private String publisherGenres;

    /** Longueur attendue du document (ex : "1 page", "1 à 2 pages") */
    private String documentLongueur;

    /** Titre de l'œuvre */
    private String manuscritTitre;

    /** Genre littéraire de l'œuvre */
    private String manuscritGenre;

    /** Nombre de signes (espaces compris) du manuscrit */
    private int manuscritSignes;

    /** Résumé libre de l'intrigue fourni par l'auteur */
    private String manuscritResume;

    /** Nom de l'auteur */
    private String auteurNom;

    /** Informations brutes sur l'auteur (pour génération de la bio) */
    private String auteurBioRaw;
}
