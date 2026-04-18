package com.scriptor.api.llm;

import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Estimation indicative du coût d'entrée (CDC §6 — ordre de grandeur pour les providers payants).
 */
@Service
public class CostEstimateService {

    private static final int CHARS_PER_TOKEN = 4;

    public Map<String, Object> estimate(int charCount, String providerId) {
        int safeChars = Math.max(0, charCount);
        int tokens = safeChars / CHARS_PER_TOKEN;
        double usdPerMillionInput = switch (providerId != null ? providerId : "") {
            case "OpenAIProvider" -> 2.50;
            case "AnthropicProvider" -> 3.00;
            case "GeminiProvider" -> 0.15;
            default -> 0.0;
        };
        double usd = (tokens / 1_000_000.0) * usdPerMillionInput;
        double rounded = Math.round(usd * 100_000.0) / 100_000.0;
        return Map.of(
                "estimatedTokens", tokens,
                "estimatedUsdInput", rounded,
                "providerId", providerId == null ? "" : providerId,
                "charCount", safeChars,
                "note", "Estimation indicative (entrée seule, tarifs publics ordre de grandeur)."
        );
    }
}
