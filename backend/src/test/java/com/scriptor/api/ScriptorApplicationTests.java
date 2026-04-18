package com.scriptor.api;

import com.scriptor.api.config.ConfigLoader;
import com.scriptor.api.llm.LLMOrchestrator;
import com.scriptor.api.llm.LLMSettingsController;
import com.scriptor.api.modules.analysis.NarrativeAnalysisController;
import com.scriptor.api.modules.annotations.AnnotationController;
import com.scriptor.api.modules.bible.BibleController;
import com.scriptor.api.modules.challenges.NarrativeChallengeController;
import com.scriptor.api.modules.characters.CharacterDetectionController;
import com.scriptor.api.modules.lexical.LexicalConstraintController;
import com.scriptor.api.modules.map.MapController;
import com.scriptor.api.modules.pageblanche.PageBlancheController;
import com.scriptor.api.modules.resume.ResumeSessionController;
import com.scriptor.api.modules.style.StyleProfileController;
import com.scriptor.api.modules.summary.ChapterSummaryController;
import com.scriptor.api.security.SecurityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test global validant l'Initialisation du Contexte Spring.
 * Si ce test passe, cela signifie que toutes les dépendances (Inversion de Contrôle)
 * sont correctement configurées et que l'API est prête à démarrer.
 */
@SpringBootTest
class ScriptorApplicationTests {

    @Autowired private LLMOrchestrator llmOrchestrator;
    @Autowired private ConfigLoader configLoader;
    @Autowired private SecurityManager securityManager;
    
    @Autowired private LLMSettingsController llmSettingsController;
    @Autowired private PageBlancheController pageBlancheController;
    @Autowired private BibleController bibleController;
    @Autowired private CharacterDetectionController characterDetectionController;
    @Autowired private AnnotationController annotationController;
    @Autowired private ResumeSessionController resumeSessionController;
    @Autowired private MapController mapController;
    @Autowired private ChapterSummaryController chapterSummaryController;
    @Autowired private NarrativeAnalysisController narrativeAnalysisController;
    @Autowired private LexicalConstraintController lexicalConstraintController;
    @Autowired private NarrativeChallengeController narrativeChallengeController;
    @Autowired private StyleProfileController styleProfileController;

    @Test
    void contextLoads() {
        assertThat(llmOrchestrator).isNotNull();
        assertThat(configLoader).isNotNull();
        assertThat(securityManager).isNotNull();
        assertThat(llmSettingsController).isNotNull();
        assertThat(pageBlancheController).isNotNull();
        assertThat(bibleController).isNotNull();
        assertThat(characterDetectionController).isNotNull();
        assertThat(annotationController).isNotNull();
        assertThat(resumeSessionController).isNotNull();
        assertThat(mapController).isNotNull();
        assertThat(chapterSummaryController).isNotNull();
        assertThat(narrativeAnalysisController).isNotNull();
        assertThat(lexicalConstraintController).isNotNull();
        assertThat(narrativeChallengeController).isNotNull();
        assertThat(styleProfileController).isNotNull();
    }
}
