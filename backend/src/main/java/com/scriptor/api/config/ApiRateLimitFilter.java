package com.scriptor.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiting simple en mémoire (fenêtre fixe) pour les écritures API IA.
 * Objectif : protection anti-abus locale sans dépendance externe.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@ConditionalOnProperty(name = "scriptor.api.rate-limit.enabled", havingValue = "true", matchIfMissing = true)
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final int RETRY_AFTER_FALLBACK_SECONDS = 1;

    private final int defaultMaxRequests;
    private final long defaultWindowMillis;
    private final int heavyMaxRequests;
    private final long heavyWindowMillis;
    private final int veryHeavyMaxRequests;
    private final long veryHeavyWindowMillis;
    private final List<String> veryHeavyPrefixes;
    private final List<String> heavyPrefixes;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    public ApiRateLimitFilter(
            @Value("${scriptor.api.rate-limit.max-requests:120}") int maxRequests,
            @Value("${scriptor.api.rate-limit.window-seconds:60}") int windowSeconds,
            @Value("${scriptor.api.rate-limit.heavy.max-requests:30}") int heavyMaxRequests,
            @Value("${scriptor.api.rate-limit.heavy.window-seconds:60}") int heavyWindowSeconds,
            @Value("${scriptor.api.rate-limit.very-heavy.max-requests:20}") int veryHeavyMaxRequests,
            @Value("${scriptor.api.rate-limit.very-heavy.window-seconds:60}") int veryHeavyWindowSeconds,
            @Value("${scriptor.api.rate-limit.very-heavy.prefixes:/api/v1/ia/summary}") String veryHeavyPrefixes,
            @Value("${scriptor.api.rate-limit.heavy.prefixes:/api/v1/ia/summary,/api/v1/ia/resume,/api/v1/ia/analysis,/api/v1/ia/challenges}") String heavyPrefixes
    ) {
        this.defaultMaxRequests = Math.max(1, maxRequests);
        this.defaultWindowMillis = Math.max(1, windowSeconds) * 1000L;
        this.heavyMaxRequests = Math.max(1, heavyMaxRequests);
        this.heavyWindowMillis = Math.max(1, heavyWindowSeconds) * 1000L;
        this.veryHeavyMaxRequests = Math.max(1, veryHeavyMaxRequests);
        this.veryHeavyWindowMillis = Math.max(1, veryHeavyWindowSeconds) * 1000L;
        this.veryHeavyPrefixes = Arrays.stream(String.valueOf(veryHeavyPrefixes).split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
        this.heavyPrefixes = Arrays.stream(String.valueOf(heavyPrefixes).split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method)) {
            return true;
        }
        String uri = request.getRequestURI();
        if (uri == null) return true;
        if (!uri.startsWith("/api/v1/ia/")) return true;
        return "/api/v1/ia/health".equals(uri) || "/api/v1/ia/ollama/status".equals(uri);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long now = Instant.now().toEpochMilli();
        LimitSpec spec = resolveLimitSpec(request.getRequestURI());
        String key = buildKey(request, spec.bucket);
        WindowCounter counter = counters.computeIfAbsent(key, ignored -> new WindowCounter(now));

        synchronized (counter) {
            if (now - counter.windowStart >= spec.windowMillis) {
                counter.windowStart = now;
                counter.count.set(0);
            }
            int current = counter.count.incrementAndGet();
            long retryAfterSeconds = Math.max(0L, (spec.windowMillis - (now - counter.windowStart)) / 1000L);
            int remaining = Math.max(0, spec.maxRequests - current);
            applyRateLimitHeaders(response, spec, remaining, retryAfterSeconds);
            if (current > spec.maxRequests) {
                response.setHeader("Retry-After", String.valueOf(Math.max(RETRY_AFTER_FALLBACK_SECONDS, retryAfterSeconds)));
                response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(), "Rate limit exceeded");
                return;
            }
        }

        // Nettoyage opportuniste pour limiter la croissance mémoire.
        if (counters.size() > 10_000) {
            long maxWindow = Math.max(defaultWindowMillis, Math.max(heavyWindowMillis, veryHeavyWindowMillis));
            counters.entrySet().removeIf(entry -> now - entry.getValue().windowStart >= maxWindow * 2);
        }

        filterChain.doFilter(request, response);
    }

    private void applyRateLimitHeaders(HttpServletResponse response, LimitSpec spec, int remaining, long resetSeconds) {
        response.setHeader("X-RateLimit-Bucket", spec.bucket);
        response.setHeader("X-RateLimit-Limit", String.valueOf(spec.maxRequests));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, remaining)));
        response.setHeader("X-RateLimit-Reset", String.valueOf(Math.max(RETRY_AFTER_FALLBACK_SECONDS, resetSeconds)));
    }

    private String buildKey(HttpServletRequest request, String bucket) {
        String ip = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        return ip + "|" + request.getMethod() + "|" + bucket;
    }

    private LimitSpec resolveLimitSpec(String uri) {
        if (uri != null) {
            for (String prefix : veryHeavyPrefixes) {
                if (uri.startsWith(prefix)) {
                    return new LimitSpec("very-heavy", veryHeavyMaxRequests, veryHeavyWindowMillis);
                }
            }
            for (String prefix : heavyPrefixes) {
                if (uri.startsWith(prefix)) {
                    return new LimitSpec("heavy", heavyMaxRequests, heavyWindowMillis);
                }
            }
        }
        return new LimitSpec("default", defaultMaxRequests, defaultWindowMillis);
    }

    private static final class WindowCounter {
        private long windowStart;
        private final AtomicInteger count = new AtomicInteger(0);

        private WindowCounter(long windowStart) {
            this.windowStart = windowStart;
        }
    }

    private record LimitSpec(String bucket, int maxRequests, long windowMillis) {}
}
