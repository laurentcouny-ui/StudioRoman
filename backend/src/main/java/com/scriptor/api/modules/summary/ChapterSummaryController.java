package com.scriptor.api.modules.summary;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST exposant la génération de résumé au Frontend React.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/summary")
@RequiredArgsConstructor
public class ChapterSummaryController {

    private final ChapterSummaryService chapterSummaryService;

    /**
     * Endpoint pour demander le résumé d'un chapitre (habituellement appelé lors d'un Ctrl+S global).
     * 
     * @param request Payload contenant le texte du chapitre.
     * @return Un futur contenant le résumé généré.
     */
    @PostMapping("/chapter")
    public CompletableFuture<ChapterSummaryResponse> generateChapterSummary(@RequestBody ChapterSummaryRequest request) {
        log.info("Requête REST reçue : /summary/chapter");
        return chapterSummaryService.generateSummary(request);
    }
}
