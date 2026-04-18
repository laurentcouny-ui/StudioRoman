package com.scriptor.api.modules.challenges;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * DTO contenant le défi généré par l'IA.
 */
@Data
@AllArgsConstructor
public class NarrativeChallengeResponse {
    private String challengeType;
    private String generatedChallenge;
}
