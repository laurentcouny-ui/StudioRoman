package com.scriptor.api.modules.lexical;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * DTO contenant le résultat de l'analyse lexicale.
 */
@Data
@AllArgsConstructor
public class LexicalAnalysisResponse {
    // Les 10 mots les plus utilisés (hors mots de liaison) avec leur fréquence
    private Map<String, Integer> topFrequentWords;
    
    // Les mots marqués comme "interdits" par l'auteur et détectés dans le texte
    private List<String> detectedForbiddenWords;
    
    // Les mots marqués comme "imposés" par l'auteur mais qui sont absents du texte
    private List<String> missingImposedWords;
}
