package com.scriptor.api.modules.challenges;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST exposant les défis narratifs au Frontend React.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/challenges")
@RequiredArgsConstructor
public class NarrativeChallengeController {

    private final NarrativeChallengeService challengeService;

    /**
     * Génère un nouveau défi (personnage_oublie, lacune_bible, style, express).
     */
    @PostMapping("/generate")
    public CompletableFuture<NarrativeChallengeResponse> generateChallenge(@Valid @RequestBody NarrativeChallengeRequest request) {
        log.info("Requête REST reçue : /challenges/generate");
        return challengeService.generateChallenge(request);
    }
}
