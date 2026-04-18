package com.scriptor.api.modules.annotations;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service responsable du stockage local et de la récupération des annotations.
 * Les données sont sauvegardées en JSON et servent de contexte pour l'IA.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnnotationService {

    private final ObjectMapper objectMapper;
    private final Object annotationsLock = new Object();

    @Value("${scriptor.data.dir:./config/data}")
    private String dataDir;

    private File getAnnotationsFile() {
        return Paths.get(dataDir, "annotations.json").toFile();
    }

    /**
     * Récupère la liste de toutes les annotations ouvertes (non résolues).
     */
    public List<Annotation> getOpenAnnotations() {
        File file = getAnnotationsFile();
        if (!file.exists()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(file, new TypeReference<List<Annotation>>() {});
        } catch (Exception e) {
            log.error("Erreur lors de la lecture des annotations. Le fichier est peut-être corrompu.", e);
            return new ArrayList<>();
        }
    }

    /**
     * Ajoute une nouvelle annotation sélectionnée par l'auteur et la sauvegarde sur le disque.
     */
    public Annotation addAnnotation(Annotation annotation) {
        if (annotation.getId() == null || annotation.getId().isBlank()) {
            annotation.setId(UUID.randomUUID().toString());
        }
        if (annotation.getTimestamp() == 0) {
            annotation.setTimestamp(System.currentTimeMillis());
        }

        synchronized (annotationsLock) {
            List<Annotation> annotations = getOpenAnnotations();
            annotations.add(annotation);
            saveAnnotations(annotations);
        }
        
        log.info("Annotation ajoutée : [{}] aux index {}-{}", annotation.getTag(), annotation.getDebut(), annotation.getFin());
        return annotation;
    }

    /**
     * Supprime une annotation par son identifiant.
     */
    public void deleteAnnotation(String id) {
        synchronized (annotationsLock) {
            List<Annotation> annotations = getOpenAnnotations();
            boolean removed = annotations.removeIf(ann -> id.equals(ann.getId()));
            if (removed) {
                saveAnnotations(annotations);
                log.info("Annotation résolue et supprimée : {}", id);
            }
        }
    }

    private void saveAnnotations(List<Annotation> annotations) {
        try {
            File file = getAnnotationsFile();
            if (!file.getParentFile().exists()) file.getParentFile().mkdirs();
            
            // Écriture atomique sécurisée anti-corruption
            File tempFile = new File(file.getAbsolutePath() + ".tmp");
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tempFile, annotations);
            try {
                Files.move(
                        tempFile.toPath(),
                        file.toPath(),
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE
                );
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(tempFile.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            log.error("Erreur critique lors de la sauvegarde des annotations.", e);
            throw new RuntimeException("Impossible de sauvegarder les annotations.", e);
        }
    }
}
