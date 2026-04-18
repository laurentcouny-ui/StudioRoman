package com.scriptor.api.llm.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.scriptor.api.llm.LLMProvider;
import com.scriptor.api.llm.ProviderConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Implémentation du provider Google Gemini utilisant l'API Generative Language.
 * Les appels sont garantis de s'exécuter sur un pool de threads HTTP distinct.
 */
@Slf4j
@Service
public class GeminiProvider implements LLMProvider {

    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final ProviderConfigService providerConfigService;

    public GeminiProvider(ProviderConfigService providerConfigService, ObjectMapper objectMapper) {
        this.providerConfigService = providerConfigService;
        this.objectMapper = objectMapper;
        // Le HttpClient natif de Java gère ses propres pools de threads pour l'asynchronisme
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_2)
                .build();
    }

    @Override
    public String getName() {
        return "Google Gemini (2.5 Flash)";
    }

    @Override
    public boolean isAvailable() {
        String key = providerConfigService.getDecryptedKey("gemini");
        return key != null && !key.isBlank();
    }

    @Override
    public CompletableFuture<String> complete(String prompt) {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                    new IllegalStateException("La clé API Gemini n'est pas configurée.")
            );
        }

        // supplyAsync bascule la préparation de la requête hors du thread appelant
        return CompletableFuture.supplyAsync(() -> {
            try {
                String apiKey = providerConfigService.getDecryptedKey("gemini");
                if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("Clé Gemini non disponible.");
                String requestBody = buildRequestBody(prompt);

                return HttpRequest.newBuilder()
                        .uri(URI.create(GEMINI_API_URL))
                        .header("x-goog-api-key", apiKey)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                        .build();
            } catch (Exception e) {
                throw new RuntimeException("Erreur de préparation de la requête Gemini.", e);
            }
        })
        // sendAsync exécute l'appel HTTP sans bloquer, en renvoyant un CompletableFuture
        .thenCompose(request -> httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString()))
        .thenApply(response -> {
            if (response.statusCode() != 200) {
                log.error("Erreur API Gemini (Code {}): {}", response.statusCode(), response.body());
                throw new RuntimeException("Échec de la communication avec Google Gemini.");
            }
            try {
                return extractTextFromResponse(response.body());
            } catch (Exception e) {
                throw new RuntimeException("Erreur lors du parsing de la réponse Gemini.", e);
            }
        });
    }

    @Override
    public void stream(String prompt, Consumer<String> onToken, Runnable onDone) {
        // Pour l'itération de base, on simule le stream via un appel asynchrone classique.
        // À l'avenir, ceci peut être branché sur le endpoint streamGenerateContent et traiter les SSE (Server-Sent Events).
        this.complete(prompt).whenComplete((response, throwable) -> {
            if (throwable != null) {
                log.error("Erreur durant le flux Gemini", throwable);
            } else {
                onToken.accept(response);
            }
            onDone.run();
        });
    }

    /**
     * Construit le corps JSON requis par la documentation de Google Generative AI.
     */
    private String buildRequestBody(String prompt) throws Exception {
        ObjectNode rootNode = objectMapper.createObjectNode();
        ArrayNode contentsArray = rootNode.putArray("contents");
        ObjectNode contentNode = contentsArray.addObject();
        ArrayNode partsArray = contentNode.putArray("parts");
        ObjectNode partNode = partsArray.addObject();
        partNode.put("text", prompt);

        return objectMapper.writeValueAsString(rootNode);
    }

    /**
     * Navigue dans l'arborescence JSON de réponse pour isoler le texte généré.
     */
    private String extractTextFromResponse(String responseBody) throws Exception {
        JsonNode rootNode = objectMapper.readTree(responseBody);
        // Path cible : candidates[0].content.parts[0].text
        return rootNode.path("candidates").path(0)
                .path("content").path("parts").path(0)
                .path("text").asText();
    }
}
