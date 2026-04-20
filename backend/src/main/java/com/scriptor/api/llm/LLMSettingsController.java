package com.scriptor.api.llm;

import com.scriptor.api.llm.providers.OllamaLocalProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Contrôleur REST permettant au Frontend de gérer les paramètres globaux de l'IA.
 */
@Slf4j
@RestController
@Validated
@RequestMapping("/api/v1/ia/settings")
@RequiredArgsConstructor
public class LLMSettingsController {

    private final LLMOrchestrator llmOrchestrator;
    private final ProviderConfigService providerConfigService;
    private final CostEstimateService costEstimateService;
    private final OllamaLocalProvider ollamaLocalProvider;
    private final LLMSettingsPersistenceService persistence;

    @GetMapping
    public Map<String, Object> getSettings() {
        return Map.of(
            "offlineMode", llmOrchestrator.isOfflineMode(),
            "silentMode", llmOrchestrator.isSilentMode(),
            "providerId", llmOrchestrator.getActiveProviderId(),
            "ollamaModel", ollamaLocalProvider.getModel()
        );
    }

    @GetMapping("/ollama/models")
    public Map<String, Object> listOllamaModels() {
        List<String> models = ollamaLocalProvider.listAvailableModels();
        return Map.of("models", models, "current", ollamaLocalProvider.getModel());
    }

    @PostMapping("/ollama/model")
    public Map<String, String> setOllamaModel(@Valid @RequestBody OllamaModelRequest body) {
        String model = body.model().trim();
        ollamaLocalProvider.setModel(model);
        persistence.saveOllamaModel(model);
        log.info("Modèle Ollama changé pour : {}", model);
        return Map.of("status", "ok", "model", model);
    }

    @PostMapping("/offline")
    public Map<String, Boolean> toggleOfflineMode(@Valid @RequestBody OfflineModeRequest request) {
        boolean offline = request.offlineMode();
        llmOrchestrator.setOfflineMode(offline);
        return Map.of("offlineMode", offline);
    }

    @PostMapping("/silent")
    public Map<String, Boolean> toggleSilentMode(@Valid @RequestBody SilentModeRequest request) {
        boolean silent = request.silentMode();
        llmOrchestrator.setSilentMode(silent);
        return Map.of("silentMode", silent);
    }
    
    @PostMapping("/provider")
    public Map<String, String> setActiveProvider(@Valid @RequestBody ProviderRequest request) {
        String providerId = request.providerId();
        llmOrchestrator.setActiveProvider(providerId);
        return Map.of("providerId", providerId);
    }

    /**
     * Estimation du coût pour un volume de texte envoyé en entrée (provider payant).
     */
    @PostMapping("/cost-estimate")
    public Map<String, Object> costEstimate(@Valid @RequestBody CostEstimateRequest body) {
        int chars = body.charCount() == null ? 10_000 : body.charCount();
        String pid = body.providerId() != null && !body.providerId().isBlank()
                ? body.providerId()
                : llmOrchestrator.getActiveProviderId();
        return costEstimateService.estimate(chars, pid);
    }

    @PostMapping("/apikey")
    public Map<String, String> saveApiKey(@Valid @RequestBody ApiKeyRequest request) {
        String providerId = request.providerId();
        String apiKey = request.apiKey();
        String yamlKey;
        if ("GeminiProvider".equals(providerId)) yamlKey = "gemini";
        else if ("OpenAIProvider".equals(providerId)) yamlKey = "openai";
        else if ("AnthropicProvider".equals(providerId)) yamlKey = "anthropic";
        else return Map.of("status", "error", "message", "Ce provider ne nécessite pas de clé API.");
        providerConfigService.saveKey(yamlKey, apiKey);
        return Map.of("status", "success");
    }

    @PostMapping("/apikey/test")
    public CompletableFuture<Map<String, Object>> testApiKey(@Valid @RequestBody ApiKeyRequest request) {
        String providerId = request.providerId();
        String apiKey = request.apiKey();
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .build();
                HttpRequest httpRequest;

                if ("OpenAIProvider".equals(providerId)) {
                    httpRequest = HttpRequest.newBuilder()
                            .uri(URI.create("https://api.openai.com/v1/models"))
                            .header("Authorization", "Bearer " + apiKey)
                            .timeout(Duration.ofSeconds(15))
                            .GET().build();
                } else if ("AnthropicProvider".equals(providerId)) {
                    // Ping minimal (max_tokens: 1) pour vérifier l'authentification
                    String payload = "{\"model\": \"claude-haiku-4-5-20251001\", \"max_tokens\": 1, \"messages\": [{\"role\": \"user\", \"content\": \"ping\"}]}";
                    httpRequest = HttpRequest.newBuilder()
                            .uri(URI.create("https://api.anthropic.com/v1/messages"))
                            .header("x-api-key", apiKey)
                            .header("anthropic-version", "2023-06-01")
                            .header("Content-Type", "application/json")
                            .timeout(Duration.ofSeconds(15))
                            .POST(HttpRequest.BodyPublishers.ofString(payload)).build();
                } else if ("GeminiProvider".equals(providerId)) {
                    httpRequest = HttpRequest.newBuilder()
                            .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey))
                            .timeout(Duration.ofSeconds(15))
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

    public record OllamaModelRequest(
            @NotBlank(message = "model est obligatoire")
            @Size(max = 120, message = "model dépasse la taille maximale autorisée")
            String model
    ) {}

    public record OfflineModeRequest(
            @NotNull(message = "offlineMode est obligatoire")
            Boolean offlineMode
    ) {}

    public record SilentModeRequest(
            @NotNull(message = "silentMode est obligatoire")
            Boolean silentMode
    ) {}

    public record ProviderRequest(
            @NotBlank(message = "providerId est obligatoire")
            @Pattern(
                    regexp = "^(OllamaLocalProvider|OpenAIProvider|AnthropicProvider|GeminiProvider)$",
                    message = "providerId invalide"
            )
            String providerId
    ) {}

    public record CostEstimateRequest(
            @Min(value = 1, message = "charCount doit être >= 1")
            @Max(value = 2_000_000, message = "charCount dépasse la limite autorisée")
            Integer charCount,
            @Size(max = 80, message = "providerId dépasse la taille maximale autorisée")
            String providerId
    ) {}

    public record ApiKeyRequest(
            @NotBlank(message = "providerId est obligatoire")
            @Pattern(
                    regexp = "^(OpenAIProvider|AnthropicProvider|GeminiProvider)$",
                    message = "providerId invalide"
            )
            String providerId,
            @NotBlank(message = "apiKey est obligatoire")
            @Size(max = 500, message = "apiKey dépasse la taille maximale autorisée")
            String apiKey
    ) {}
}
