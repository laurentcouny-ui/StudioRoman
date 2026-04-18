package com.scriptor.api.modules.lexical;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.StandardCopyOption;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service analysant les fréquences de mots et le respect des contraintes lexicales.
 * Approche algorithmique pure (sans LLM) pour une fiabilité mathématique garantie.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LexicalConstraintService {

    private final ObjectMapper objectMapper;

    @Value("${scriptor.data.dir:./config/data}")
    private String dataDir;
    private final Object lexiconWriteLock = new Object();

    // Liste basique des mots de liaison à ignorer dans l'analyse de fréquence
    private static final Set<String> STOP_WORDS = Set.of(
            "le", "la", "les", "un", "une", "des", "de", "du", "à", "au", "aux", 
            "et", "ou", "mais", "donc", "or", "ni", "car", "pour", "dans", "sur", 
            "sous", "vers", "avec", "sans", "par", "qui", "que", "quoi", "dont", 
            "où", "ce", "se", "ne", "pas", "plus", "il", "elle", "on", "ils", 
            "elles", "je", "tu", "nous", "vous", "est", "sont", "a", "ont"
    );

    public CompletableFuture<LexicalAnalysisResponse> analyzeLexicon(LexicalAnalysisRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            log.info("Lancement de l'analyse des contraintes lexicales...");

            String text = request.getText() == null ? "" : request.getText().toLowerCase();
            
            List<String> forbiddenList = new ArrayList<>();
            List<String> imposedList = new ArrayList<>();
            loadLexiconData(forbiddenList, imposedList);

            // 1. Extraction et comptage des mots
            Map<String, Integer> wordFrequencies = new HashMap<>();
            Matcher matcher = Pattern.compile("\\b[a-zà-ÿ0-9]+\\b").matcher(text);
            
            Set<String> wordsInText = new HashSet<>();
            while (matcher.find()) {
                String word = matcher.group();
                wordsInText.add(word);
                if (!STOP_WORDS.contains(word) && word.length() > 2) {
                    wordFrequencies.put(word, wordFrequencies.getOrDefault(word, 0) + 1);
                }
            }

            // 2. Identification des 10 mots les plus fréquents (hors stop-words)
            Map<String, Integer> topFrequent = wordFrequencies.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(10)
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue,
                            (e1, e2) -> e1,
                            LinkedHashMap::new
                    ));

            // 3. Vérification des mots interdits (tics de l'auteur) présents dans le texte
            List<String> detectedForbidden = forbiddenList.stream()
                    .filter(w -> wordsInText.contains(w.toLowerCase()))
                    .collect(Collectors.toList());

            // 4. Vérification des mots imposés absents du texte
            List<String> missingImposed = imposedList.stream()
                    .filter(w -> !wordsInText.contains(w.toLowerCase()))
                    .collect(Collectors.toList());

            log.info("Analyse lexicale terminée. {} mots distincts analysés.", wordsInText.size());
            return new LexicalAnalysisResponse(topFrequent, detectedForbidden, missingImposed);
        });
    }

    private void loadLexiconData(List<String> forbiddenList, List<String> imposedList) {
        File lexiconFile = Paths.get(dataDir, "lexicon.json").toFile();
        if (!lexiconFile.exists()) return;

        try {
            JsonNode rootNode = objectMapper.readTree(lexiconFile);
            if (rootNode.has("mots_interdits")) {
                rootNode.get("mots_interdits").forEach(node -> forbiddenList.add(node.asText()));
            }
            if (rootNode.has("mots_imposes")) {
                rootNode.get("mots_imposes").forEach(node -> imposedList.add(node.asText()));
            }
        } catch (Exception e) {
            log.error("Erreur lors de la lecture de lexicon.json", e);
        }
    }

    public Map<String, List<String>> getLexiconRules() {
        List<String> forbidden = new ArrayList<>();
        List<String> imposed = new ArrayList<>();
        loadLexiconData(forbidden, imposed);
        return Map.of(
                "mots_interdits", forbidden,
                "mots_imposes", imposed
        );
    }

    public Map<String, List<String>> saveLexiconRules(Map<String, List<String>> payload) {
        List<String> forbidden = normalizeList(payload != null ? payload.get("mots_interdits") : null);
        List<String> imposed = normalizeList(payload != null ? payload.get("mots_imposes") : null);

        synchronized (lexiconWriteLock) {
            try {
                File lexiconFile = Paths.get(dataDir, "lexicon.json").toFile();
                if (!lexiconFile.getParentFile().exists()) lexiconFile.getParentFile().mkdirs();

                Map<String, Object> toWrite = new LinkedHashMap<>();
                toWrite.put("mots_interdits", forbidden);
                toWrite.put("mots_imposes", imposed);

                File tempFile = new File(lexiconFile.getAbsolutePath() + ".tmp");
                objectMapper.writerWithDefaultPrettyPrinter().writeValue(tempFile, toWrite);
                try {
                    Files.move(
                            tempFile.toPath(),
                            lexiconFile.toPath(),
                            StandardCopyOption.REPLACE_EXISTING,
                            StandardCopyOption.ATOMIC_MOVE
                    );
                } catch (AtomicMoveNotSupportedException ex) {
                    Files.move(tempFile.toPath(), lexiconFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (Exception e) {
                log.error("Erreur lors de la sauvegarde des règles lexicales.", e);
                throw new RuntimeException("Impossible de sauvegarder les règles lexicales.", e);
            }
        }

        return Map.of(
                "mots_interdits", forbidden,
                "mots_imposes", imposed
        );
    }

    private List<String> normalizeList(List<String> input) {
        if (input == null) return List.of();
        return input.stream()
                .map(s -> s == null ? "" : s.trim())
                .filter(s -> !s.isBlank())
                .map(String::toLowerCase)
                .distinct()
                .toList();
    }
}
