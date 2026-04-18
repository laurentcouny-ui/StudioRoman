package com.scriptor.api.modules.characters;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Consultation des fiches personnages (anti-hallucination : uniquement les données persistées).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CharacterCatalogService {

    private final CharacterRepository characterRepository;

    public String queryCharacters(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return "Requête invalide.";
        }
        String kw = keyword.trim();
        try {
            List<CharacterEntity> entries = characterRepository.searchByKeyword(kw);
            if (entries.isEmpty()) {
                return "Information introuvable dans les fiches personnages. Ne déduisez rien : cet élément n'est pas documenté.";
            }
            return entries.stream().map(this::formatCharacter).collect(Collectors.joining("\n\n"));
        } catch (Exception e) {
            log.error("Erreur lors de la consultation des fiches personnages.", e);
            return "Erreur technique lors de la consultation des fiches personnages.";
        }
    }

    private String formatCharacter(CharacterEntity e) {
        String nom = e.getNom() != null ? e.getNom() : "Sans nom";
        String role = e.getRole() != null && !e.getRole().isBlank() ? e.getRole() : "—";
        String statut = e.getStatut() != null && !e.getStatut().isBlank() ? e.getStatut() : "—";
        String desc = e.getDescription() != null ? e.getDescription().trim() : "";
        return String.format(
                "[Source: Fiche personnage « %s », rôle « %s », statut « %s »]\n%s",
                nom, role, statut, desc);
    }
}
