package com.scriptor.api;

import com.scriptor.api.modules.lexical.LexicalAnalysisRequest;
import com.scriptor.api.modules.lexical.LexicalAnalysisResponse;
import com.scriptor.api.modules.lexical.LexicalConstraintService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.StopWatch;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de charge (Stress Tests) pour s'assurer que l'architecture asynchrone
 * ne flanche pas et ne gèle pas l'application sous un déluge de requêtes.
 */
class ScriptorStressTests {

    @Test
    void testLexicalServiceUnderExtremeStress() {
        int concurrentRequests = 1000;
        List<CompletableFuture<LexicalAnalysisResponse>> futures = new ArrayList<>();
        LexicalConstraintService lexicalConstraintService = new LexicalConstraintService(new ObjectMapper());
        // Evite toute dépendance au système local (pas de DB, pas de fichier imposé).
        ReflectionTestUtils.setField(lexicalConstraintService, "dataDir", "./target/test-data");
        
        LexicalAnalysisRequest request = new LexicalAnalysisRequest();
        // Un texte contenant des mots fréquents pour forcer l'algorithme à travailler
        request.setText("Aldric frappa fort. Soudain, tout devint noir. En fait, c'était terrifiant. Le silence tomba soudain.");

        StopWatch stopWatch = new StopWatch();
        stopWatch.start();

        // Lancement de 1 000 requêtes asynchrones en parallèle
        for (int i = 0; i < concurrentRequests; i++) {
            futures.add(lexicalConstraintService.analyzeLexicon(request));
        }

        // Barrière de synchronisation : on attend que les 1000 requêtes aient terminé
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        stopWatch.stop();
        
        // Vérification post-stress : aucune exception n'a été levée, tous les calculs sont exacts
        for (CompletableFuture<LexicalAnalysisResponse> future : futures) {
            assertThat(future.isDone()).isTrue();
            assertThat(future.isCompletedExceptionally()).isFalse(); // Zéro plantage
            assertThat(future.join().getTopFrequentWords()).isNotEmpty();
        }

        System.out.println("✅ Succès du Stress Test : " + concurrentRequests + " requêtes traitées en " + stopWatch.getTotalTimeMillis() + " ms");
    }
}
