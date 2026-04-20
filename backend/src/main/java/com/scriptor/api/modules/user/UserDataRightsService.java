package com.scriptor.api.modules.user;

import com.scriptor.api.modules.bible.BibleEntity;
import com.scriptor.api.modules.bible.BibleRepository;
import com.scriptor.api.modules.characters.CharacterEntity;
import com.scriptor.api.modules.characters.CharacterRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserDataRightsService {

    private final CharacterRepository characterRepository;
    private final BibleRepository bibleRepository;

    public UserDataRightsService(CharacterRepository characterRepository, BibleRepository bibleRepository) {
        this.characterRepository = characterRepository;
        this.bibleRepository = bibleRepository;
    }

    public Map<String, Object> exportUserData() {
        List<CharacterEntity> characters = characterRepository.findAll();
        List<BibleEntity> bibleEntries = bibleRepository.findAll();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("exportedAt", Instant.now().toString());
        payload.put("context", "desktop-local-first");
        payload.put("note", "No central cloud account is stored by backend.");
        payload.put("characters", characters);
        payload.put("bibleEntries", bibleEntries);
        payload.put("counts", Map.of(
                "characters", characters.size(),
                "bibleEntries", bibleEntries.size()
        ));
        return payload;
    }

    @Transactional
    public Map<String, Object> deleteLocalUserData() {
        long charactersBefore = characterRepository.count();
        long bibleBefore = bibleRepository.count();

        characterRepository.deleteAllInBatch();
        bibleRepository.deleteAllInBatch();

        return Map.of(
                "deleted", true,
                "context", "desktop-local-first",
                "deletedCounts", Map.of(
                        "characters", charactersBefore,
                        "bibleEntries", bibleBefore
                ),
                "message", "Local workspace data deleted from main tables."
        );
    }
}
