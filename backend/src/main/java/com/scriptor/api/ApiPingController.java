package com.scriptor.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ping minimal hors préfixe /api/v1/ia : évite les conflits possibles avec le routage SPA
 * ou la résolution de ressources sur certaines configs Spring Boot 3.2+.
 */
@RestController
public class ApiPingController {

    @GetMapping(value = "/api/health", produces = MediaType.TEXT_PLAIN_VALUE)
    public String ping() {
        return "ok";
    }
}
