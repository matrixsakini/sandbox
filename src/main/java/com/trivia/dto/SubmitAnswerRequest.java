package com.trivia.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record SubmitAnswerRequest(
        @NotBlank String questionId,
        @Min(0) int chosenIndex
) {}