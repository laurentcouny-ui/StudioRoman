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
public class OpenAIProvider implements LLMProvider {

    private static final String API_URL = "https://api.openai.com/v1/chat/completions";
    private final ProviderConfigService providerConfigService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Override
    public String getName() {
        return "OpenAI GPT-4o";
    }

    @Override
    public boolean isAvailable() {
        String key = providerConfigService.getDecryptedKey("openai");
        return key != null && !key.isBlank();
    }

    @Override
    public CompletableFuture<String> complete(String prompt) {
        if (!isAvailable()) return CompletableFuture.failedFuture(new IllegalStateException("Clé OpenAI non configurée."));
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                String apiKey = providerConfigService.getDecryptedKey("openai");
                if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("Clé OpenAI non disponible.");
                ObjectNode root = objectMapper.createObjectNode();
                root.put("model", "gpt-4o");
                ArrayNode msgs = root.putArray("messages");
                ObjectNode msg = msgs.addObject();
                msg.put("role", "user");
                msg.put("content", prompt);

                return HttpRequest.newBuilder()
                        .uri(URI.create(API_URL))
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)))
                        .build();
            } catch (Exception e) {
                throw new RuntimeException("Erreur préparation requête OpenAI", e);
            }
        }).thenCompose(req -> httpClient.sendAsync(req, HttpResponse.BodyHandlers.ofString())).thenApply(res -> {
            try {
                if (res.statusCode() != 200) {
                    log.error("Erreur OpenAI (status={}): réponse non-200", res.statusCode());
                    throw new RuntimeException("Erreur OpenAI (HTTP " + res.statusCode() + ")");
                }
                return objectMapper.readTree(res.body()).path("choices").path(0).path("message").path("content").asText();
            } catch (Exception e) {
                throw new RuntimeException("Erreur lecture réponse OpenAI", e);
            }
        });
    }

    @Override
    public void stream(String prompt, Consumer<String> onToken, Runnable onDone) {
        this.complete(prompt).whenComplete((res, err) -> { if (err == null) onToken.accept(res); onDone.run(); });
    }
}
