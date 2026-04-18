package com.scriptor.api.modules.analysis;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class EndBookReviewResponse {
    private String reviewQuestions;
    private String forgottenCharacters;
}
