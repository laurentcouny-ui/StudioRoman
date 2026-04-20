package com.scriptor.api.oauth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Corps JSON attendu depuis le frontend pour l’échange code → jetons (proxy vers Google).
 */
public record GoogleTokenExchangeRequest(
        @NotBlank(message = "code est obligatoire")
        @Size(max = 4096, message = "code dépasse la taille maximale autorisée")
        String code,
        @NotBlank(message = "redirectUri est obligatoire")
        @Pattern(regexp = "^https?://.+", message = "redirectUri doit être une URL HTTP/HTTPS valide")
        @Size(max = 2048, message = "redirectUri dépasse la taille maximale autorisée")
        String redirectUri,
        @NotBlank(message = "codeVerifier est obligatoire")
        @Size(min = 43, max = 128, message = "codeVerifier doit respecter la taille PKCE")
        String codeVerifier
) {}
