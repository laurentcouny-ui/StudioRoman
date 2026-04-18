package com.scriptor.api.modules.analysis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/api/v1/ia/analysis/review")
@RequiredArgsConstructor
public class EndBookReviewController {
    private final EndBookReviewService endBookReviewService;

    @PostMapping
    public CompletableFuture<EndBookReviewResponse> generateReview(@RequestBody EndBookReviewRequest request) {
        log.info("Requête REST reçue : /analysis/review");
        return endBookReviewService.generateReview(request);
    }
}
