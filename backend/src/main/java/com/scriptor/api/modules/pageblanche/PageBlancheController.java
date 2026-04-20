package com.scriptor.api.modules.pageblanche;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST exposant la fonctionnalité "Page Blanche" au Frontend React.
 * Fait le pont entre l'interface utilisateur et la logique métier de l'IA.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/page-blanche")
@RequiredArgsConstructor
public class PageBlancheController {

    private final PageBlancheService pageBlancheService;

    /**
     * Endpoint appelé par le Frontend lorsque l'auteur déclenche l'IA (Panneau ou bouton dédié).
     * Renvoie un CompletableFuture pour garantir l'asynchronisme au niveau HTTP.
     *
     * @param request Le payload contenant le texte, la position du curseur et le ton souhaité.
     * @return Un futur contenant la réponse JSON avec les questions de relance.
     */
    @PostMapping("/diagnose")
    public CompletableFuture<PageBlancheResponse> diagnose(@Valid @RequestBody PageBlancheRequest request) {
        log.info("Requête REST reçue : /diagnose (Ton demandé: {})", request.getTone());
        return pageBlancheService.diagnose(request);
    }
}
