package com.scriptor.api;

import com.scriptor.api.llm.providers.OllamaLocalProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Santé de l’API IA — utilisé par le frontend pour afficher un message clair si le backend est coupé.
 */
@RestController
@RequestMapping("/api/v1/ia")
public class IaHealthController {

    private final OllamaLocalProvider ollamaLocalProvider;

    @Value("${scriptor.providers.ollama.url:http://127.0.0.1:11434}")
    private String ollamaUrl;

    @Value("${scriptor.providers.ollama.model:qwen2.5:3b}")
    private String ollamaModel;

    public IaHealthController(OllamaLocalProvider ollamaLocalProvider) {
        this.ollamaLocalProvider = ollamaLocalProvider;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "ok", true,
                "service", "scriptor-ia-api"
        );
    }

    /**
     * Indique si le daemon Ollama répond sur la machine (CDC §6 — dégradation gracieuse côté UI).
     */
    @GetMapping("/ollama/status")
    public Map<String, Object> ollamaStatus() {
        boolean reachable = ollamaLocalProvider.isAvailable();
        String message = reachable
                ? "Ollama joignable sur cette machine."
                : "Ollama ne répond pas. Installez Ollama et lancez le service (ex. ollama serve), puis vérifiez le port configuré.";
        return Map.of(
                "reachable", reachable,
                "model", ollamaModel,
                "baseUrl", ollamaUrl,
                "message", message
        );
    }
}
