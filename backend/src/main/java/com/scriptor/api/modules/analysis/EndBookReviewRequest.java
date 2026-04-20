package com.scriptor.api.modules.analysis;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class EndBookReviewRequest {
    @NotBlank(message = "fullText est obligatoire")
    @Size(max = 600_000, message = "fullText dépasse la taille maximale autorisée")
    private String fullText;
}
