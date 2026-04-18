package com.scriptor.api.oauth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Proxy d’échange OAuth Google pour clients de type « Application ordinateur » : le
 * {@code client_secret} reste côté serveur (fichier {@code oauth-local.properties} ou variables
 * {@code SCR_GOOGLE_DESKTOP_*}), jamais dans le bundle Tauri/Vite.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/oauth/google")
public class GoogleDesktopOAuthController {

    private final RestClient restClient = RestClient.create();

    @Value("${scriptor.oauth.google.client-id:}")
    private String clientId;

    @Value("${scriptor.oauth.google.client-secret:}")
    private String clientSecret;

    @PostMapping(
            value = "/token",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> exchange(@RequestBody GoogleTokenExchangeRequest body) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            log.warn("Échange token Google refusé : identifiants scriptor.oauth.google.* non configurés");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(
                            "{\"error\":\"oauth_backend_not_configured\",\"error_description\":\"Configurer oauth-local.properties (exemple : oauth-local.properties.example) ou SCR_GOOGLE_DESKTOP_CLIENT_ID / SCR_GOOGLE_DESKTOP_CLIENT_SECRET\"}");
        }
        if (body == null || body.code() == null || body.code().isBlank()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"invalid_request\",\"error_description\":\"code manquant\"}");
        }
        if (body.redirectUri() == null || body.redirectUri().isBlank()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"invalid_request\",\"error_description\":\"redirectUri manquant\"}");
        }
        if (body.codeVerifier() == null || body.codeVerifier().isBlank()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"invalid_request\",\"error_description\":\"codeVerifier manquant\"}");
        }

        log.info("Proxy OAuth Google : échange code → jeton (PKCE + secret serveur, code non journalisé)");

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", body.code());
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", body.redirectUri());
        form.add("code_verifier", body.codeVerifier());
        form.add("grant_type", "authorization_code");

        try {
            ResponseEntity<String> google = restClient
                    .post()
                    .uri("https://oauth2.googleapis.com/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toEntity(String.class);
            return ResponseEntity.status(google.getStatusCode()).body(google.getBody());
        } catch (RestClientResponseException ex) {
            HttpStatus st = HttpStatus.resolve(ex.getStatusCode().value());
            return ResponseEntity.status(st != null ? st : HttpStatus.BAD_GATEWAY)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(ex.getResponseBodyAsString());
        }
    }
}
