package com.scriptor.api.llm.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.scriptor.api.llm.LLMProvider;
import com.scriptor.api.llm.ProviderConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnthropicProvider implements LLMProvider {

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private final ProviderConfigService providerConfigService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Override
    public String getName() {
        return "Anthropic Claude 3.5";
    }

    @Override
    public boolean isAvailable() {
        String key = providerConfigService.getDecryptedKey("anthropic");
        return key != null && !key.isBlank();
    }

    @Override
    public CompletableFuture<String> complete(String prompt) {
        if (!isAvailable()) return CompletableFuture.failedFuture(new IllegalStateException("Clé Anthropic non configurée."));
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                String apiKey = providerConfigService.getDecryptedKey("anthropic");
                if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("Clé Anthropic non disponible.");
                ObjectNode root = objectMapper.createObjectNode();
                root.put("model", "claude-3-5-sonnet-20240620");
                root.put("max_tokens", 1024);
                ArrayNode msgs = root.putArray("messages");
                ObjectNode msg = msgs.addObject();
                msg.put("role", "user");
                msg.put("content", prompt);

                return HttpRequest.newBuilder()
                        .uri(URI.create(API_URL))
                        .header("x-api-key", apiKey)
                        .header("anthropic-version", "2023-06-01")
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)))
                        .build();
            } catch (Exception e) {
                throw new RuntimeException("Erreur préparation requête Anthropic", e);
            }
        }).thenCompose(req -> httpClient.sendAsync(req, HttpResponse.BodyHandlers.ofString())).thenApply(res -> {
            try {
                if (res.statusCode() != 200) throw new RuntimeException("Erreur Anthropic: " + res.body());
                return objectMapper.readTree(res.body()).path("content").path(0).path("text").asText();
            } catch (Exception e) {
                throw new RuntimeException("Erreur lecture réponse Anthropic", e);
            }
        });
    }

    @Override
    public void stream(String prompt, Consumer<String> onToken, Runnable onDone) {
        this.complete(prompt).whenComplete((res, err) -> { if (err == null) onToken.accept(res); onDone.run(); });
    }
}
