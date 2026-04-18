package com.scriptor.api.modules.annotations;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST pour la gestion des annotations en temps réel.
 * Expose les opérations de lecture et de sauvegarde au Frontend React.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/annotations")
@RequiredArgsConstructor
public class AnnotationController {

    private final AnnotationService annotationService;

    @GetMapping
    public CompletableFuture<List<Annotation>> getOpenAnnotations() {
        log.info("Requête REST reçue : GET /annotations");
        // Exécution asynchrone pour ne pas bloquer le thread HTTP durant l'I/O disque
        return CompletableFuture.supplyAsync(annotationService::getOpenAnnotations);
    }

    @PostMapping
    public CompletableFuture<Annotation> addAnnotation(@RequestBody Annotation annotation) {
        log.info("Requête REST reçue : POST /annotations (Tag: {}, Index {}-{})", 
                annotation.getTag(), annotation.getDebut(), annotation.getFin());
                
        // Exécution asynchrone pour l'écriture dans le fichier JSON
        return CompletableFuture.supplyAsync(() -> annotationService.addAnnotation(annotation));
    }

    @DeleteMapping("/{id}")
    public CompletableFuture<Void> deleteAnnotation(@PathVariable String id) {
        log.info("Requête REST reçue : DELETE /annotations/{}", id);
        // Exécution asynchrone pour ne pas bloquer le thread HTTP
        return CompletableFuture.runAsync(() -> annotationService.deleteAnnotation(id));
    }
}
