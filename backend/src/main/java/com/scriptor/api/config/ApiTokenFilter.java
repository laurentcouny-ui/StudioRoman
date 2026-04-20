package com.scriptor.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Protection optionnelle par jeton partagé pour les endpoints API.
 * Désactivée par défaut pour ne pas casser les environnements existants.
 */
@Component
@ConditionalOnProperty(name = "scriptor.api.require-token", havingValue = "true")
public class ApiTokenFilter extends OncePerRequestFilter {

    private final String expectedToken;

    public ApiTokenFilter(@Value("${scriptor.api.token:}") String expectedToken) {
        this.expectedToken = expectedToken == null ? "" : expectedToken.trim();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/api/") && !"/api/health".equals(uri)) {
            if (expectedToken.isBlank()) {
                response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "API token is required but not configured");
                return;
            }
            String token = extractToken(request);
            if (!expectedToken.equals(token)) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing or invalid API token");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String headerToken = request.getHeader("X-Scriptor-Api-Token");
        if (headerToken != null && !headerToken.isBlank()) {
            return headerToken.trim();
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring("Bearer ".length()).trim();
        }
        return "";
    }
}
