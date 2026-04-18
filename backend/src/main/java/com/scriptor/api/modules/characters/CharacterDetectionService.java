package com.scriptor.api.modules.characters;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service de détection des personnages à la fin d'une scène.
 * S'exécute uniquement à la sauvegarde ou au marquage manuel, jamais en temps réel.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CharacterDetectionService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final CharacterRepository characterRepository;

    /**
     * Analyse une scène pour en extraire la liste des personnages présents.
     *
     * @param sceneText Le texte de la scène.
     * @return Un Future contenant la réponse de l'IA (idéalement une liste de noms).
     */
    public CompletableFuture<String> detectCharactersInScene(String sceneText) {
        log.info("Lancement de la détection de personnages pour la scène...");

        // 1. Extraction des personnages existants dans l'univers (Anti-hallucination)
        List<String> knownCharacters = getKnownCharacters();
        String knownCharsString = String.join(", ", knownCharacters);

        // 2. Chargement du prompt métier
        String systemPrompt = configLoader.getPrompt("personnages.detection_prompt");
        if (systemPrompt == null) {
            // Fallback de sécurité si le YAML n'est pas encore à jour
            systemPrompt = "Tu es un assistant analytique. Identifie les personnages actifs dans le texte fourni. " +
                           "Tu ne dois sélectionner que les personnages figurant dans la liste autorisée. " +
                           "Ne justifie pas, réponds uniquement par une liste de noms séparés par des virgules.";
        }

        // 3. Assemblage du super-prompt
        String finalPrompt = String.format("%s\n\n[Liste des personnages autorisés : %s]\n\n[Texte de la scène]\n%s",
                systemPrompt, knownCharsString.isEmpty() ? "Aucun personnage enregistré" : knownCharsString, sceneText);

        // 4. Appel asynchrone au LLM
        return llmOrchestrator.complete(finalPrompt)
                .exceptionally(ex -> {
                    log.error("Échec lors de la détection des personnages.", ex);
                    return "Erreur lors de la détection des personnages.";
                });
    }

    /**
     * Interroge SQLite pour récupérer les noms de tous les personnages de l'auteur.
     */
    private List<String> getKnownCharacters() {
        return characterRepository.findAll().stream()
                .map(CharacterEntity::getNom)
                .filter(nom -> nom != null && !nom.isBlank())
                .toList();
    }
}
