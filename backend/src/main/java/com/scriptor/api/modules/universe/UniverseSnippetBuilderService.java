package com.scriptor.api.modules.universe;

import com.scriptor.api.llm.ContextWindowManager;
import com.scriptor.api.modules.bible.BibleEntity;
import com.scriptor.api.modules.bible.BibleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Extraits bible + chronologie pour enrichir la page blanche (CDC §8.1).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UniverseSnippetBuilderService {

    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}']{4,}");

    private final BibleRepository bibleRepository;
    private final ContextWindowManager contextWindowManager;
    private final ChronologyContextService chronologyContextService;

    public List<String> buildRelevantSnippets(String fullText, int cursorPosition) {
        List<String> snippets = new ArrayList<>();
        int budget = 0;
        final int maxBudget = 1400;

        String window = contextWindowManager.extractSlidingWindow(
                fullText == null ? "" : fullText,
                cursorPosition < 0 ? 0 : cursorPosition
        );
        Set<String> keywords = extractKeywords(window, 4);
        for (String kw : keywords) {
            if (kw.length() < 4) {
                continue;
            }
            List<BibleEntity> hits = bibleRepository.findByContenuContainingIgnoreCase(kw);
            for (BibleEntity be : hits) {
                String line = String.format(
                        "[Source bible — fiche « %s », section « %s », par. %d] %s",
                        nullToDash(be.getFiche()),
                        nullToDash(be.getSection()),
                        be.getParagraphe(),
                        truncate(be.getContenu(), 280)
                );
                if (budget + line.length() > maxBudget) {
                    return finishWithChrono(snippets, maxBudget - budget);
                }
                snippets.add(line);
                budget += line.length();
            }
        }

        return finishWithChrono(snippets, maxBudget - budget);
    }

    private List<String> finishWithChrono(List<String> snippets, int remaining) {
        String chrono = chronologyContextService.readSummary(Math.max(200, remaining));
        if (!chrono.isBlank()) {
            snippets.add("=== Chronologie (synchronisée depuis le projet) ===\n" + chrono);
        }
        return snippets;
    }

    private Set<String> extractKeywords(String text, int max) {
        Set<String> out = new LinkedHashSet<>();
        if (text == null) {
            return out;
        }
        var m = WORD.matcher(text);
        while (m.find() && out.size() < max) {
            String w = m.group().toLowerCase();
            if (w.length() >= 5) {
                out.add(w);
            }
        }
        return out;
    }

    private static String nullToDash(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.trim().replaceAll("\\s+", " ");
        return t.length() <= max ? t : t.substring(0, max) + "…";
    }
}
