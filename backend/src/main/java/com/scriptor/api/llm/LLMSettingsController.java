package com.scriptor.api.llm;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST permettant au Frontend de gérer les paramètres globaux de l'IA.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ia/settings")
@RequiredArgsConstructor
public class LLMSettingsController {

    private final LLMOrchestrator llmOrchestrator;
    private final ProviderConfigService providerConfigService;
    private final CostEstimateService costEstimateService;

    @GetMapping
    public Map<String, Object> getSettings() {
        return Map.of(
            "offlineMode", llmOrchestrator.isOfflineMode(),
            "silentMode", llmOrchestrator.isSilentMode(),
            "providerId", llmOrchestrator.getActiveProviderId()
        );
    }

    @PostMapping("/offline")
    public Map<String, Boolean> toggleOfflineMode(@RequestBody Map<String, Boolean> request) {
        boolean offline = request.getOrDefault("offlineMode", false);
        llmOrchestrator.setOfflineMode(offline);
        return Map.of("offlineMode", offline);
    }

    @PostMapping("/silent")
    public Map<String, Boolean> toggleSilentMode(@RequestBody Map<String, Boolean> request) {
        boolean silent = request.getOrDefault("silentMode", false);
        llmOrchestrator.setSilentMode(silent);
        return Map.of("silentMode", silent);
    }
    
    @PostMapping("/provider")
    public Map<String, String> setActiveProvider(@RequestBody Map<String, String> request) {
        String providerId = request.getOrDefault("providerId", "OllamaLocalProvider");
        llmOrchestrator.setActiveProvider(providerId);
        return Map.of("providerId", providerId);
    }

    /**
     * Estimation du coût pour un volume de texte envoyé en entrée (provider payant).
     */
    @PostMapping("/cost-estimate")
    public Map<String, Object> costEstimate(@RequestBody Map<String, Object> body) {
        int chars = 10_000;
        if (body != null && body.get("charCount") instanceof Number n) {
            chars = n.intValue();
        }
        String pid = body != null && body.get("providerId") instanceof String s && !s.isBlank()
                ? s
                : llmOrchestrator.getActiveProviderId();
        return costEstimateService.estimate(chars, pid);
    }

    @PostMapping("/apikey")
    public Map<String, String> saveApiKey(@RequestBody Map<String, String> request) {
        String providerId = request.get("providerId");
        String apiKey = request.get("apiKey");
        String yamlKey;
        if ("GeminiProvider".equals(providerId)) yamlKey = "gemini";
        else if ("OpenAIProvider".equals(providerId)) yamlKey = "openai";
        else if ("AnthropicProvider".equals(providerId)) yamlKey = "anthropic";
        else return Map.of("status", "error", "message", "Ce provider ne nécessite pas de clé API.");
        providerConfigService.saveKey(yamlKey, apiKey);
        return Map.of("status", "success");
    }

    @PostMapping("/apikey/test")
    public CompletableFuture<Map<String, Object>> testApiKey(@RequestBody Map<String, String> request) {
        String providerId = request.get("providerId");
        String apiKey = request.get("apiKey");
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                HttpClient client = HttpClient.newBuilder().build();
                HttpRequest httpRequest;

                if ("OpenAIProvider".equals(providerId)) {
                    httpRequest = HttpRequest.newBuilder()
                            .uri(URI.create("https://api.openai.com/v1/models"))
                            .header("Authorization", "Bearer " + apiKey)
                            .GET().build();
                } else if ("AnthropicProvider".equals(providerId)) {
                    // Ping minimal (max_tokens: 1) pour vérifier l'authentification
                    String payload = "{\"model\": \"claude-haiku-4-5-20251001\", \"max_tokens\": 1, \"messages\": [{\"role\": \"user\", \"content\": \"ping\"}]}";
                    httpRequest = HttpRequest.newBuilder()
                            .uri(URI.create("https://api.anthropic.com/v1/messages"))
                            .header("x-api-key", apiKey)
                            .header("anthropic-version", "2023-06-01")
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(payload)).build();
                } else if ("GeminiProvider".equals(providerId)) {
                    httpRequest = HttpRequest.newBuilder()
                            .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey))
                            .GET().build();
                } else {
                    return Map.of("success", false, "message", "Provider inconnu.");
                }

                HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
                boolean isSuccess = response.statusCode() == 200;
                return Map.of("success", isSuccess, "message", isSuccess ? "Connexion réussie !" : "Clé invalide ou refusée (Code " + response.statusCode() + ").");
            } catch (Exception e) {
                return Map.of("success", false, "message", "Erreur réseau : " + e.getMessage());
            }
        });
    }
}
