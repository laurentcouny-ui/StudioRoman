package com.scriptor.api.llm;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Contrat unique pour tous les fournisseurs d'Intelligence Artificielle (Ollama, Gemini, OpenAI, etc.).
 * Respecte le principe d'architecture modulaire du cahier des charges.
 */
public interface LLMProvider {

    /**
     * Récupère le nom lisible du provider (ex: "Ollama Local", "Google Gemini").
     */
    String getName();

    /**
     * Indique si le provider est prêt à être utilisé (ex: clé API renseignée et valide, ou service local actif).
     */
    boolean isAvailable();

    /**
     * Envoie un prompt au modèle et retourne la réponse complète.
     * Utilise CompletableFuture pour garantir que l'appel s'exécute sur un thread séparé,
     * évitant tout blocage du thread principal (Zero-freeze rule).
     *
     * @param prompt Le texte du prompt généré à partir des fichiers YML.
     * @return Un Future contenant la réponse du modèle.
     */
    CompletableFuture<String> complete(String prompt);

    /**
     * Envoie un prompt et traite la réponse par flux continu (Streaming).
     * Exécution garantie sur un thread séparé.
     *
     * @param prompt  Le texte du prompt généré.
     * @param onToken Callback invoqué à chaque nouveau fragment de texte généré.
     * @param onDone  Callback invoqué une fois la génération complètement terminée.
     */
    void stream(String prompt, Consumer<String> onToken, Runnable onDone);
}
