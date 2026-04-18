package com.scriptor.api.llm.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.scriptor.api.llm.LLMProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Implémentation du provider local Ollama.
 * Modèle par défaut gratuit (Mistral ou Llama 3).
 * Garantit une exécution 100% asynchrone et une dégradation gracieuse si le daemon est éteint.
 */
@Slf4j
@Service
public class OllamaLocalProvider implements LLMProvider {

    private static final int TAGS_CHECK_TIMEOUT_SEC = 3;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Duration requestTimeout;
    private final Duration connectTimeout;

    @Value("${scriptor.providers.ollama.url:http://127.0.0.1:11434}")
    private String ollamaUrl;

    @Value("${scriptor.providers.ollama.model:qwen2.5:3b}")
    private String ollamaModel;

    public OllamaLocalProvider(
            ObjectMapper objectMapper,
            @Value("${scriptor.ollama.connect-timeout-seconds:15}") int connectTimeoutSeconds,
            @Value("${scriptor.ollama.request-timeout-seconds:300}") int requestTimeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        int connectSec = Math.min(30, Math.max(10, connectTimeoutSeconds));
        this.connectTimeout = Duration.ofSeconds(connectSec);
        this.requestTimeout = Duration.ofSeconds(Math.max(1, requestTimeoutSeconds));
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(this.connectTimeout)
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    @Override
    public String getName() {
        return "Ollama Local (" + ollamaModel + ")";
    }

    @Override
    public boolean isAvailable() {
        String url = ollamaUrl + "/api/tags";
        long t0 = System.nanoTime();
        try {
            log.info("OllamaLocalProvider : GET {} (health check, timeout={}s)", url, TAGS_CHECK_TIMEOUT_SEC);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(TAGS_CHECK_TIMEOUT_SEC))
                    .GET()
                    .build();
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            double elapsedSec = (System.nanoTime() - t0) / 1_000_000_000.0;
            boolean ok = response.statusCode() == 200;
            log.info("OllamaLocalProvider : /api/tags terminé après {} s | statusHTTP={} | available={}",
                    String.format(Locale.ROOT, "%.3f", elapsedSec), response.statusCode(), ok);
            return ok;
        } catch (Exception e) {
            double elapsedSec = (System.nanoTime() - t0) / 1_000_000_000.0;
            log.warn("OllamaLocalProvider : /api/tags échec après {} s — {} : {}",
                    String.format(Locale.ROOT, "%.3f", elapsedSec),
                    e.getClass().getSimpleName(), e.getMessage());
            return false;
        }
    }

    @Override
    public CompletableFuture<String> complete(String prompt) {
        final int promptChars = prompt == null ? 0 : prompt.length();
        return CompletableFuture.supplyAsync(() -> {
            try {
                return buildRequestBody(prompt, false);
            } catch (Exception e) {
                throw new RuntimeException("Erreur de préparation de la requête Ollama.", e);
            }
        })
        .thenCompose(body -> {
            long t0 = System.nanoTime();
            log.info(
                    "OllamaLocalProvider : POST {}/api/generate | prompt={} caractères | corps JSON={} octets | timeoutRequête={}s | connectTimeoutClient={}s",
                    ollamaUrl, promptChars, body.length(), requestTimeout.toSeconds(), connectTimeout.toSeconds()
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaUrl + "/api/generate"))
                    .header("Content-Type", "application/json")
                    .timeout(requestTimeout)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            long asyncCapSec = requestTimeout.toSeconds() + 10;
            return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .orTimeout(asyncCapSec, TimeUnit.SECONDS)
                    .whenComplete((resp, err) -> {
                        double elapsedSec = (System.nanoTime() - t0) / 1_000_000_000.0;
                        if (err != null) {
                            log.warn(
                                    "OllamaLocalProvider : /api/generate terminé après {} s avec exception : {}",
                                    String.format(Locale.ROOT, "%.3f", elapsedSec),
                                    err
                            );
                        } else {
                            log.info(
                                    "OllamaLocalProvider : /api/generate terminé après {} s | statusHTTP={}",
                                    String.format(Locale.ROOT, "%.3f", elapsedSec),
                                    resp != null ? resp.statusCode() : -1
                            );
                        }
                    });
        })
        .thenApply(response -> {
            if (response.statusCode() != 200) {
                log.error("Erreur API Ollama (Code {}): {}", response.statusCode(), response.body());
                throw new RuntimeException(buildOllamaHttpErrorMessage(response.statusCode(), response.body()));
            }
            try {
                return extractTextFromResponse(response.body());
            } catch (Exception e) {
                throw new RuntimeException("Erreur de lecture de la réponse Ollama.", e);
            }
        })
        .exceptionally(ex -> {
            log.warn(
                    "Dégradation gracieuse OllamaLocalProvider : échec de la génération Ollama — aucun autre provider LLM n'est invoqué ici (pas de relai) ; message de substitution renvoyé au client.",
                    ex
            );
            return buildUserFacingFallbackMessage(ex);
        });
    }

    @Override
    public void stream(String prompt, Consumer<String> onToken, Runnable onDone) {
        final int promptChars = prompt == null ? 0 : prompt.length();
        CompletableFuture.supplyAsync(() -> {
            try {
                return buildRequestBody(prompt, true);
            } catch (Exception e) {
                throw new RuntimeException("Erreur de préparation de la requête stream Ollama.", e);
            }
        }).thenCompose(body -> {
            long t0 = System.nanoTime();
            log.info(
                    "OllamaLocalProvider : POST {}/api/generate (stream=true) | prompt={} caractères | corps JSON={} octets | timeoutRequête={}s | connectTimeoutClient={}s",
                    ollamaUrl, promptChars, body.length(), requestTimeout.toSeconds(), connectTimeout.toSeconds()
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaUrl + "/api/generate"))
                    .header("Content-Type", "application/json")
                    .timeout(requestTimeout)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            long asyncCapSec = requestTimeout.toSeconds() + 10;
            return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofLines())
                    .orTimeout(asyncCapSec, TimeUnit.SECONDS)
                    .whenComplete((resp, err) -> {
                        double elapsedSec = (System.nanoTime() - t0) / 1_000_000_000.0;
                        if (err != null) {
                            log.warn(
                                    "OllamaLocalProvider : /api/generate (stream) terminé après {} s avec exception : {}",
                                    String.format(Locale.ROOT, "%.3f", elapsedSec),
                                    err
                            );
                        } else {
                            log.info(
                                    "OllamaLocalProvider : /api/generate (stream) terminé après {} s | statusHTTP={}",
                                    String.format(Locale.ROOT, "%.3f", elapsedSec),
                                    resp != null ? resp.statusCode() : -1
                            );
                        }
                    });
        }).thenAccept(response -> {
            if (response.statusCode() != 200) {
                String errorBody = response.body().findFirst().orElse("");
                onToken.accept("[" + buildOllamaHttpErrorMessage(response.statusCode(), errorBody) + "]");
                return;
            }
            response.body().forEach(line -> {
                try {
                    JsonNode node = objectMapper.readTree(line);
                    if (node.has("response")) {
                        onToken.accept(node.get("response").asText());
                    }
                } catch (Exception e) {
                    log.trace("Ligne ignorée dans le flux Ollama: {}", line);
                }
            });
        }).exceptionally(ex -> {
            log.warn(
                    "Dégradation gracieuse OllamaLocalProvider (stream) : échec Ollama — aucun autre provider LLM n'est invoqué (pas de relai) ; message d'erreur injecté dans le flux.",
                    ex
            );
            onToken.accept("[" + buildUserFacingFallbackMessage(ex) + "]");
            return null;
        }).thenRun(onDone);
    }

    private String buildRequestBody(String prompt, boolean stream) throws Exception {
        ObjectNode rootNode = objectMapper.createObjectNode();
        rootNode.put("model", ollamaModel);
        rootNode.put("prompt", prompt);
        rootNode.put("stream", stream);
        return objectMapper.writeValueAsString(rootNode);
    }

    private String extractTextFromResponse(String responseBody) throws Exception {
        return objectMapper.readTree(responseBody).path("response").asText();
    }

    private String buildOllamaHttpErrorMessage(int statusCode, String body) {
        String normalized = body == null ? "" : body.toLowerCase();
        if (statusCode == 404) {
            return "Ollama est joignable, mais le modèle \"" + ollamaModel + "\" est introuvable. Lancez : ollama pull " + ollamaModel;
        }
        if (statusCode == 500 && normalized.contains("llama runner process has terminated")) {
            return "Ollama est bien démarré, mais le runner du modèle a planté. Redémarrez Ollama, puis réessayez (ou testez un modèle plus léger).";
        }
        if (statusCode == 500) {
            return "Ollama répond, mais la génération a échoué (HTTP 500). Vérifiez les logs Ollama et le modèle \"" + ollamaModel + "\".";
        }
        return "Ollama a renvoyé une erreur HTTP " + statusCode + ". Vérifiez la configuration locale du modèle \"" + ollamaModel + "\".";
    }

    private String buildUserFacingFallbackMessage(Throwable throwable) {
        Throwable root = throwable;
        while (root != null && root.getCause() != null) {
            root = root.getCause();
        }

        String msg = root == null ? "" : String.valueOf(root.getMessage());
        String lower = msg.toLowerCase();

        if (root instanceof ConnectException || root instanceof HttpTimeoutException || lower.contains("connectexception")) {
            String hint = ollamaUrl != null && ollamaUrl.toLowerCase().contains("localhost")
                    ? " Astuce Windows : essayez SCR_OLLAMA_URL=http://127.0.0.1:11434 si Ollama tourne mais \"localhost\" échoue."
                    : "";
            return "Le service Ollama local ne répond pas sur " + ollamaUrl
                    + ". Vérifiez qu'il est lancé (ollama serve) et que le port 11434 est bien ouvert."
                    + hint;
        }
        if (lower.contains("timed out") || lower.contains("timeout")) {
            return "Ollama met trop de temps à répondre. Essayez un modèle plus léger ou redémarrez Ollama.";
        }
        if (lower.contains("llama runner process has terminated")) {
            return "Ollama est démarré, mais le runner du modèle a planté. Redémarrez Ollama puis réessayez.";
        }
        if (!msg.isBlank()) {
            return msg;
        }
        return "Erreur de communication avec Ollama. Vérifiez le service local et le modèle configuré.";
    }
}
