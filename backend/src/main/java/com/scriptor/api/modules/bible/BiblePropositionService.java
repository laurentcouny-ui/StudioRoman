package com.scriptor.api.modules.bible;

import com.scriptor.api.modules.universe.UniverseConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ajoute une entrée dans la fiche réservée « propositions assistant » (CDC §10).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BiblePropositionService {

    private final BibleRepository bibleRepository;

    @Transactional
    public BibleEntity appendProposedSummary(String contenu, String sectionTitre) {
        int next = bibleRepository.findAll().stream()
                .filter(b -> UniverseConstants.IA_PROPOSITIONS_FICHE.equals(b.getFiche()))
                .mapToInt(BibleEntity::getParagraphe)
                .max()
                .orElse(0) + 1;

        BibleEntity e = new BibleEntity();
        e.setFiche(UniverseConstants.IA_PROPOSITIONS_FICHE);
        e.setSection(sectionTitre != null && !sectionTitre.isBlank() ? sectionTitre : "Résumé proposé");
        e.setParagraphe(next);
        e.setContenu(contenu != null ? contenu : "");
        return bibleRepository.save(e);
    }
}
