package com.scriptor.api.modules.style;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.ArrayList;
import java.util.List;

/**
 * Représente le profil stylistique de l'auteur.
 */
@Data
public class StyleProfile {
    // Les extraits bruts choisis par l'auteur (3 à 5 recommandés)
    private List<String> extraits = new ArrayList<>();
    /** Rapport d'analyse LLM (synthèse du ton narratif). */
    @JsonProperty("analysisReport")
    @JsonAlias("analyseIa")
    private String analysisReport = "";
}
