package com.scriptor.api.modules.publisher;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * DTO de réponse contenant le texte généré.
 */
@Data
@AllArgsConstructor
public class PublisherGenerateResponse {
    private String text;
}
