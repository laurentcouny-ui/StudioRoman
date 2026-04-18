package com.scriptor.api.modules.universe;

import com.scriptor.api.modules.bible.BibleEntity;
import com.scriptor.api.modules.bible.BibleRepository;
import com.scriptor.api.modules.characters.CharacterEntity;
import com.scriptor.api.modules.characters.CharacterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aligne la base IA (personnages, bible) et la chronologie fichier avec le projet Scriptor.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectUniverseSyncService {

    private final CharacterRepository characterRepository;
    private final BibleRepository bibleRepository;
    private final ChronologyContextService chronologyContextService;

    @Transactional
    public void syncFromProject(ProjectUniverseSyncRequest request) {
        characterRepository.deleteAll();

        if (request.getCharacters() != null) {
            for (ProjectUniverseSyncRequest.CharacterDto c : request.getCharacters()) {
                if (c == null) continue;
                CharacterEntity e = new CharacterEntity();
                e.setNom(c.getNom() != null ? c.getNom() : "");
                e.setRole(c.getRole() != null ? c.getRole() : "");
                e.setDescription(c.getDescription() != null ? c.getDescription() : "");
                e.setStatut(c.getStatut() != null ? c.getStatut() : "");
                characterRepository.save(e);
            }
        }

        bibleRepository.deleteAllExceptFiche(UniverseConstants.IA_PROPOSITIONS_FICHE);

        int seq = 1;
        if (request.getBibleEntries() != null) {
            for (ProjectUniverseSyncRequest.BibleEntryDto b : request.getBibleEntries()) {
                if (b == null) continue;
                String contenu = b.getContenu() != null ? b.getContenu() : "";
                if (contenu.isBlank()) continue;
                BibleEntity be = new BibleEntity();
                be.setFiche(b.getFiche() != null && !b.getFiche().isBlank() ? b.getFiche() : "Bible");
                be.setSection(b.getSection() != null && !b.getSection().isBlank() ? b.getSection() : "Entrée");
                be.setParagraphe(b.getParagraphe() != null && b.getParagraphe() > 0 ? b.getParagraphe() : seq++);
                be.setContenu(contenu);
                bibleRepository.save(be);
            }
        }

        chronologyContextService.writeFromSync(
                request.getTimelineEvents() != null ? request.getTimelineEvents() : java.util.List.of()
        );

        log.info("Synchro univers : {} perso(s), {} entrée(s) bible.",
                request.getCharacters() != null ? request.getCharacters().size() : 0,
                request.getBibleEntries() != null ? request.getBibleEntries().size() : 0);
    }
}
