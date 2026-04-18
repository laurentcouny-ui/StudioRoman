package com.scriptor.api.modules.challenges;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.modules.characters.CharacterEntity;
import com.scriptor.api.modules.characters.ForgottenCharacterRequest;
import com.scriptor.api.modules.characters.ForgottenCharacterService;
import com.scriptor.api.modules.characters.CharacterRepository;
import com.scriptor.api.modules.style.StyleProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

/**
 * Service générant des défis narratifs organiques pour relancer la créativité.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NarrativeChallengeService {

    private final LLMOrchestrator llmOrchestrator;
    private final ConfigLoader configLoader;
    private final CharacterRepository characterRepository;
    private final ForgottenCharacterService forgottenCharacterService;
    private final StyleProfileService styleProfileService;

    public CompletableFuture<NarrativeChallengeResponse> generateChallenge(NarrativeChallengeRequest request) {
        String type = request.getChallengeType() != null ? request.getChallengeType().toLowerCase() : "express";
        log.info("Génération d'un défi narratif de type : {}", type);

        String promptTpl = configLoader.getPrompt("challenges." + type);
        if (promptTpl == null) {
            promptTpl = "Propose un défi créatif court et direct pour débloquer l'auteur.";
        }

        final String finalPromptTemplate = promptTpl;
        String contextData = request.getContextData();
        String recentText = request.getRecentText();

        return resolveContextData(type, contextData, recentText)
                .thenCompose(ctx -> {
                    String finalPrompt = buildPromptForType(type, finalPromptTemplate, ctx)
                            + styleProfileService.styleReferenceBlockForPrompts();
                    return llmOrchestrator.complete(finalPrompt);
                })
                .thenApply(challengeText -> new NarrativeChallengeResponse(type, challengeText))
                .exceptionally(ex -> {
                    log.error("Échec lors de la génération du défi.", ex);
                    return new NarrativeChallengeResponse(type, "Impossible de générer le défi. Prenez 5 minutes pour écrire librement ce qui vous passe par la tête !");
                });
    }

    private CompletableFuture<String> resolveContextData(String type, String contextData, String recentText) {
        if ("personnage_oublie".equals(type)) {
            if (contextData != null && !contextData.isBlank()) {
                return CompletableFuture.completedFuture(contextData.trim());
            }
            if (recentText != null && !recentText.isBlank()) {
                ForgottenCharacterRequest req = new ForgottenCharacterRequest();
                req.setRecentText(recentText);
                return forgottenCharacterService.detectForgottenCharacters(req)
                        .thenApply(resp -> extractCharacterCandidate(resp != null ? resp.getForgottenCharacters() : null))
                        .thenApply(name -> (name == null || name.isBlank()) ? getRandomCharacter() : name)
                        .exceptionally(ex -> getRandomCharacter());
            }
            return CompletableFuture.completedFuture(getRandomCharacter());
        }

        if ("lacune_bible".equals(type) && (contextData == null || contextData.isBlank())) {
            return CompletableFuture.completedFuture(suggestBibleGapFromText(recentText));
        }

        return CompletableFuture.completedFuture(contextData == null ? "" : contextData.trim());
    }

    private String buildPromptForType(String type, String template, String providedContext) {
        if ("personnage_oublie".equals(type)) {
            String character = (providedContext != null && !providedContext.isBlank()) ? providedContext : getRandomCharacter();
            return String.format(template, character);
        } else if ("lacune_bible".equals(type)) {
            return String.format(template, providedContext != null && !providedContext.isBlank() ? "Contexte additionnel : " + providedContext : "");
        }
        // Pour style et express, pas de paramètre de string format particulier
        return template;
    }

    private String extractCharacterCandidate(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String cleaned = raw.replace("Absents détectés :", "").trim();
        if (cleaned.equalsIgnoreCase("aucun")) return "";
        String[] chunks = cleaned.split("[,\\n;]+");
        for (String chunk : chunks) {
            String name = chunk.trim();
            if (!name.isBlank() && !name.equalsIgnoreCase("aucun")) return name;
        }
        return "";
    }

    private String suggestBibleGapFromText(String recentText) {
        if (recentText == null || recentText.isBlank()) {
            return "Aucune piste contextuelle fournie : choisissez un lieu, une règle ou une institution à documenter.";
        }
        String plain = Pattern.compile("<[^>]+>").matcher(recentText).replaceAll(" ");
        String[] words = plain.split("\\s+");
        String pivot = "";
        for (String w : words) {
            String t = w == null ? "" : w.trim();
            if (t.length() >= 7 && Character.isUpperCase(t.charAt(0))) {
                pivot = t.replaceAll("[^\\p{L}\\p{N}'-]", "");
                if (!pivot.isBlank()) break;
            }
        }
        if (pivot.isBlank()) {
            return "Piste suggérée : documenter une règle implicite de votre univers absente de la bible.";
        }
        return "Piste suggérée : documenter l'élément « " + pivot + " » (origine, règles, limites, conséquences).";
    }

    private String getRandomCharacter() {
        List<String> characters = characterRepository.findAll().stream()
                .map(CharacterEntity::getNom)
                .filter(nom -> nom != null && !nom.isBlank())
                .toList();
                
        if (characters.isEmpty()) return "un habitant anonyme de votre univers";
        return characters.get(ThreadLocalRandom.current().nextInt(characters.size()));
    }
}
