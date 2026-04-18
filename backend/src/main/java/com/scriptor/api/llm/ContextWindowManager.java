package com.scriptor.api.llm;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.scriptor.api.modules.annotations.Annotation;
import java.util.List;

/**
 * Gestionnaire de la fenêtre glissante (Token Limiter).
 * Garantit que les prompts envoyés aux modèles ne saturent jamais la fenêtre de contexte.
 */
@Slf4j
@Service
public class ContextWindowManager {

    // Heuristique standard : 1 token équivaut à environ 4 caractères en français/anglais.
    private static final int CHARS_PER_TOKEN = 4;
    
    // Limite stricte définie dans le cahier des charges
    private static final int MAX_TOKENS_AROUND_CURSOR = 2000;

    /**
     * Extrait une fenêtre de texte autour du curseur sans dépasser la limite de tokens.
     * Répartition : 75% du contexte avant le curseur, 25% après le curseur.
     *
     * @param fullText       Le texte complet du chapitre ou de la scène.
     * @param cursorPosition La position (index) actuelle du curseur de l'auteur.
     * @return Le sous-texte respectant la limite de contexte.
     */
    public String extractSlidingWindow(String fullText, int cursorPosition) {
        if (fullText == null || fullText.isEmpty()) {
            return "";
        }

        int maxChars = MAX_TOKENS_AROUND_CURSOR * CHARS_PER_TOKEN;
        if (fullText.length() <= maxChars) {
            return fullText; // Le texte est suffisamment court, on prend tout.
        }

        // Sécurisation de la position du curseur
        int safeCursor = Math.max(0, Math.min(cursorPosition, fullText.length()));

        // Répartition asymétrique : l'historique (avant curseur) est plus pertinent que la suite
        int charsBefore = (int) (maxChars * 0.75);
        int charsAfter = maxChars - charsBefore;

        int start = safeCursor - charsBefore;
        int end = safeCursor + charsAfter;

        // Ajustement si le début déborde (on est au tout début du texte)
        if (start < 0) {
            end += Math.abs(start);
            start = 0;
        }

        // Ajustement si la fin déborde (on est tout à la fin du texte)
        if (end > fullText.length()) {
            start -= (end - fullText.length());
            end = fullText.length();
            // Re-vérification de la borne inférieure au cas où le texte complet soit plus petit que maxChars
            if (start < 0) {
                start = 0;
            }
        }

        log.debug("Fenêtre glissante extraite : curseur={}, start={}, end={}, length={}", 
                safeCursor, start, end, (end - start));
        
        return fullText.substring(start, end);
    }

    /**
     * Assemble le texte de la fenêtre glissante avec des extraits pertinents (Bible, annotations).
     */
    public String buildContextPayload(String fullText, int cursorPosition, List<String> relevantSnippets) {
        return buildContextPayload(fullText, cursorPosition, relevantSnippets, null);
    }

    /**
     * Surcharge : Assemble le texte avec les extraits pertinents ET les annotations de l'auteur.
     */
    public String buildContextPayload(String fullText, int cursorPosition, List<String> relevantSnippets, List<Annotation> annotations) {
        String window = extractSlidingWindow(fullText, cursorPosition);
        
        StringBuilder payload = new StringBuilder();
        payload.append("=== CONTEXTE DU TEXTE ===\n").append(window).append("\n\n");
        
        // Les extraits pertinents seront limités en amont par leurs propres modules (Bible/Map)
        if (relevantSnippets != null && !relevantSnippets.isEmpty()) {
            payload.append("=== DONNÉES DE L'UNIVERS ===\n");
            for (String snippet : relevantSnippets) {
                payload.append("- ").append(snippet).append("\n");
            }
        }
        
        // Injection des annotations laissées par l'auteur en suspens
        if (annotations != null && !annotations.isEmpty()) {
            payload.append("\n=== ANNOTATIONS DE L'AUTEUR ===\n");
            for (Annotation ann : annotations) {
                // Sécurisation au cas où le texte complet aurait été tronqué depuis l'ajout de l'annotation
                int start = Math.max(0, ann.getDebut());
                int end = Math.min(fullText.length(), ann.getFin());
                String annotatedText = (start < end) ? fullText.substring(start, end).trim() : "[Texte modifié/introuvable]";
                
                payload.append("- Note [").append(ann.getTag()).append("] sur l'extrait : \"").append(annotatedText).append("\"\n");
            }
        }
        
        return payload.toString();
    }

    /**
     * Estime grossièrement le nombre de tokens d'une chaîne.
     */
    public int estimateTokens(String text) {
        if (text == null) return 0;
        return text.length() / CHARS_PER_TOKEN;
    }
}
