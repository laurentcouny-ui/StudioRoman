package com.scriptor.api.modules.resume;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST pour la fiche de reprise automatique.
 * Appelée par l'UI à l'ouverture du projet si l'absence dépasse 24h.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/resume")
@RequiredArgsConstructor
public class ResumeSessionController {

    private final ResumeSessionService resumeSessionService;

    @PostMapping("/generate")
    public CompletableFuture<ResumeSessionResponse> generateResumeSheet(@Valid @RequestBody ResumeSessionRequest request) {
        log.info("Requête REST reçue : /resume/generate (Ton: {})", request.getTone());
        return resumeSessionService.generateResumeSheet(request);
    }
}
