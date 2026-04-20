package com.scriptor.api.modules.universe;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/api/v1/ia/universe")
@RequiredArgsConstructor
public class ProjectUniverseSyncController {

    private final ProjectUniverseSyncService projectUniverseSyncService;

    @PostMapping("/sync")
    public CompletableFuture<Map<String, String>> sync(@Valid @RequestBody ProjectUniverseSyncRequest body) {
        log.info("Requête REST : POST /universe/sync");
        return CompletableFuture.supplyAsync(() -> {
            projectUniverseSyncService.syncFromProject(body);
            return Map.of("status", "ok");
        });
    }
}
