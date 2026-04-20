package com.scriptor.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Garde-fou desktop : refuse les appels API provenant d'une adresse non-loopback.
 */
@Component
@ConditionalOnProperty(name = "scriptor.api.loopback-only", havingValue = "true", matchIfMissing = true)
public class LocalOnlyApiFilter extends OncePerRequestFilter {

    private static final Set<String> LOOPBACKS = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/api/")) {
            String remoteAddr = request.getRemoteAddr();
            if (!LOOPBACKS.contains(remoteAddr)) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "API access is restricted to loopback");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
