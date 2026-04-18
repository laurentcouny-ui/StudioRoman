package com.scriptor.api.modules.bible;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service de lecture de la Bible (Anti-hallucination).
 * Interroge l'index JSON de l'univers de l'auteur sans base de données vectorielle complexe.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BibleReaderService {

    private final BibleRepository bibleRepository;

    /**
     * Recherche un terme ou une question dans la bible.
     * Applique strictement la règle du cahier des charges : si introuvable = message clair, zéro déduction.
     *
     * @param keyword Le mot-clé ou le nom recherché (ex: "Aldric", "Magie du sang").
     * @return Les extraits trouvés formatés avec leurs sources exactes, ou un message de blocage d'hallucination.
     */
    public String queryBible(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return "Requête invalide.";
        }

        try {
            // Spring Data JPA va automatiquement générer la requête LIKE %keyword% (insensible à la casse)
            List<BibleEntity> entries = bibleRepository.findByContenuContainingIgnoreCase(keyword);

            List<String> results = entries.stream()
                    .map(entry -> String.format("[Source: Fiche « %s », section « %s », par. %d] %s",
                            entry.getFiche(), entry.getSection(), entry.getParagraphe(), entry.getContenu()))
                    .collect(Collectors.toList());

            return results.isEmpty() 
                    ? "Information introuvable dans la bible. Vous devez dire à l'auteur que cet élément n'est pas documenté, sans rien inventer ni déduire." 
                    : String.join("\n\n", results);

        } catch (Exception e) {
            log.error("Erreur critique lors de la lecture de la bible.", e);
            return "Erreur technique lors de la consultation de la bible.";
        }
    }
}
