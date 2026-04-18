package com.scriptor.api.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptor.api.modules.bible.BibleEntity;
import com.scriptor.api.modules.bible.BibleRepository;
import com.scriptor.api.modules.characters.CharacterEntity;
import com.scriptor.api.modules.characters.CharacterRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.nio.file.Paths;

/**
 * Service s'exécutant au démarrage pour migrer les anciens fichiers JSON vers SQLite.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataMigrationService {

    private final CharacterRepository characterRepository;
    private final BibleRepository bibleRepository;
    private final ObjectMapper objectMapper;

    @Value("${scriptor.data.dir:./config/data}")
    private String dataDir;

    @PostConstruct
    public void migrateAll() {
        migrateCharacters();
        migrateBible();
    }

    private void migrateCharacters() {
        File oldJsonFile = Paths.get(dataDir, "characters.json").toFile();
        
        if (oldJsonFile.exists()) {
            log.info("Migration de characters.json vers SQLite en cours...");
            try {
                JsonNode rootNode = objectMapper.readTree(oldJsonFile);
                if (rootNode.isArray()) {
                    rootNode.forEach(node -> {
                        CharacterEntity character = new CharacterEntity();
                        character.setNom(node.path("nom").asText(""));
                        character.setRole(node.path("role").asText(""));
                        character.setDescription(node.path("description").asText(""));
                        character.setStatut(node.path("statut").asText(""));
                        characterRepository.save(character);
                    });
                }
                // Renomme le fichier pour ne plus déclencher la migration
                moveToMigratedOrFail(oldJsonFile, Paths.get(dataDir, "characters.json.migrated").toFile());
                log.info("Migration réussie ! Anciennes données sécurisées dans characters.json.migrated");
            } catch (Exception e) {
                log.error("Erreur lors de la migration des personnages", e);
            }
        }
    }

    private void migrateBible() {
        File oldJsonFile = Paths.get(dataDir, "bible.json").toFile();
        
        if (oldJsonFile.exists()) {
            log.info("Migration de bible.json vers SQLite en cours...");
            try {
                JsonNode rootNode = objectMapper.readTree(oldJsonFile);
                if (rootNode.isArray()) {
                    rootNode.forEach(node -> {
                        BibleEntity entry = new BibleEntity();
                        entry.setFiche(node.path("fiche").asText("Général"));
                        entry.setSection(node.path("section").asText("Non classé"));
                        entry.setParagraphe(node.path("paragraphe").asInt(1));
                        entry.setContenu(node.path("contenu").asText(""));
                        bibleRepository.save(entry);
                    });
                }
                moveToMigratedOrFail(oldJsonFile, Paths.get(dataDir, "bible.json.migrated").toFile());
                log.info("Migration réussie ! Anciennes données sécurisées dans bible.json.migrated");
            } catch (Exception e) {
                log.error("Erreur lors de la migration de la bible", e);
            }
        }
    }

    private void moveToMigratedOrFail(File source, File target) throws Exception {
        try {
            Files.move(
                    source.toPath(),
                    target.toPath(),
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE
            );
        } catch (AtomicMoveNotSupportedException ex) {
            Files.move(source.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
