package com.scriptor.api.modules.publisher;

import com.scriptor.api.llm.LLMOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Génère les documents de soumission éditeur (lettre, synopsis, note d'intention, bio)
 * en construisant des prompts contextuels adaptés à chaque maison d'édition.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublisherService {

    private final LLMOrchestrator llmOrchestrator;

    public CompletableFuture<PublisherGenerateResponse> generate(PublisherGenerateRequest req) {
        String prompt = buildPrompt(req);
        log.info("Génération document éditeur '{}' pour '{}'", req.getDocumentType(), req.getPublisherNom());
        return llmOrchestrator.complete(prompt)
                .thenApply(PublisherGenerateResponse::new)
                .whenComplete((ok, ex) -> {
                    if (ex != null) log.error("Échec génération document éditeur.", ex);
                });
    }

    private String buildPrompt(PublisherGenerateRequest r) {
        String signesFormates = r.getManuscritSignes() > 0
                ? String.format("%,d signes (environ %d pages)", r.getManuscritSignes(), r.getManuscritSignes() / 1500)
                : "longueur non précisée";

        String contexte = String.format("""
                CONTEXTE DU MANUSCRIT
                ─────────────────────
                Titre       : %s
                Genre       : %s
                Longueur    : %s
                Auteur      : %s

                Résumé de l'intrigue (fourni par l'auteur) :
                %s

                MAISON D'ÉDITION CIBLÉE
                ───────────────────────
                Nom         : %s
                Spécialité  : %s
                Genres      : %s
                """,
                orDefault(r.getManuscritTitre(), "Sans titre"),
                orDefault(r.getManuscritGenre(), "non précisé"),
                signesFormates,
                orDefault(r.getAuteurNom(), "l'auteur"),
                orDefault(r.getManuscritResume(), "(résumé non fourni)"),
                orDefault(r.getPublisherNom(), "inconnue"),
                orDefault(r.getPublisherSpecialite(), "non précisée"),
                orDefault(r.getPublisherGenres(), "non précisés")
        );

        return switch (orDefault(r.getDocumentType(), "lettre")) {
            case "lettre" -> buildLettrePrompt(contexte, r);
            case "synopsis" -> buildSynopsisPrompt(contexte, r);
            case "noteIntention" -> buildNoteIntentionPrompt(contexte, r);
            case "bio" -> buildBioPrompt(contexte, r);
            default -> buildLettrePrompt(contexte, r);
        };
    }

    private String buildLettrePrompt(String contexte, PublisherGenerateRequest r) {
        String longueur = orDefault(r.getDocumentLongueur(), "1 page");
        return String.format("""
                Tu es un expert en soumission éditoriale française. Rédige une lettre d'accompagnement professionnelle.

                RÈGLES ABSOLUES :
                - Longueur : %s maximum
                - Ton : professionnel, sincère, jamais servile
                - Structure : accroche sur l'œuvre → présentation de l'auteur → pourquoi cet éditeur spécifiquement → formule de politesse
                - Personnalise la lettre pour %s en mentionnant ce qui lie l'œuvre à leur ligne éditoriale
                - Utilise le vouvoiement. Commence par "Madame, Monsieur,"
                - N'invente pas d'informations absentes du contexte

                %s
                """, longueur, orDefault(r.getPublisherNom(), "cet éditeur"), contexte);
    }

    private String buildSynopsisPrompt(String contexte, PublisherGenerateRequest r) {
        String longueur = orDefault(r.getDocumentLongueur(), "1 à 2 pages");
        return String.format("""
                Tu es un expert en soumission éditoriale française. Rédige un synopsis professionnel.

                RÈGLES ABSOLUES :
                - Longueur : %s
                - Ton : narratif, présent de narration, sans jugement de valeur
                - Structure : situation initiale → élément déclencheur → développement → enjeu central → dénouement (le dénoument DOIT être révélé dans un synopsis)
                - Présente les personnages principaux avec leur fonction dramatique
                - Sois factuel et précis, jamais publicitaire
                - N'invente pas d'éléments absents du résumé fourni — si le résumé est incomplet, structure ce qui existe

                %s
                """, longueur, contexte);
    }

    private String buildNoteIntentionPrompt(String contexte, PublisherGenerateRequest r) {
        String longueur = orDefault(r.getDocumentLongueur(), "1 page");
        return String.format("""
                Tu es un expert en soumission éditoriale française. Rédige une note d'intention artistique.

                RÈGLES ABSOLUES :
                - Longueur : %s
                - Ton : réflexif, personnel, mais professionnel
                - Structure : genèse du projet → choix d'écriture (forme, voix, point de vue) → thèmes portés → public visé → résonnance avec la ligne de %s
                - Parle au nom de l'auteur à la première personne
                - Évite les formules creuses comme "ce roman est une exploration de..."
                - Reste concret et spécifique

                %s
                """, longueur, orDefault(r.getPublisherNom(), "cet éditeur"), contexte);
    }

    private String buildBioPrompt(String contexte, PublisherGenerateRequest r) {
        String bioRaw = orDefault(r.getAuteurBioRaw(), "");
        String auteur = orDefault(r.getAuteurNom(), "l'auteur");
        return String.format("""
                Tu es un expert en soumission éditoriale française. Rédige une courte biographie d'auteur.

                RÈGLES ABSOLUES :
                - Longueur : 5 à 10 lignes maximum
                - Ton : sobre, factuel, sans auto-promotion excessive
                - Structure : formation/parcours → expérience liée à l'écriture → publications éventuelles → lien avec le projet soumis
                - Rédige à la troisième personne ("%s...")
                - Si les informations brutes sont insuffisantes, rédige une bio minimale sobre et honnête
                - N'invente aucune information

                Informations brutes sur l'auteur :
                %s

                %s
                """, auteur, bioRaw.isEmpty() ? "(aucune information fournie)" : bioRaw, contexte);
    }

    private static String orDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value.trim();
    }
}
