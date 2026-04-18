package com.scriptor.api.modules.pageblanche;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * DTO (Data Transfer Object) renvoyé au Frontend (React) contenant les questions générées.
 */
@Data
@AllArgsConstructor
public class PageBlancheResponse {
    // Le ton qui a été utilisé pour générer la réponse
    private String toneUsed;
    // Les 2 ou 3 questions générées par l'IA pour débloquer l'auteur
    private String questions;
}
