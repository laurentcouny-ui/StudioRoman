package com.scriptor.api.modules.publisher;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Endpoint REST pour la génération des documents de soumission éditeur.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/publisher")
@RequiredArgsConstructor
public class PublisherController {

    private final PublisherService publisherService;

    /**
     * Génère un document de soumission (lettre, synopsis, note d'intention, bio)
     * adapté à la maison d'édition ciblée.
     */
    @PostMapping("/generate")
    public CompletableFuture<PublisherGenerateResponse> generate(@Valid @RequestBody PublisherGenerateRequest request) {
        log.info("POST /publisher/generate — type={}, éditeur={}",
                request.getDocumentType(), request.getPublisherNom());
        return publisherService.generate(request);
    }
}
