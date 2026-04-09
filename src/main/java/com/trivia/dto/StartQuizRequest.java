package com.trivia.dto;

import jakarta.validation.constraints.NotBlank;

public record StartQuizRequest(
        @NotBlank String topic,
        @NotBlank String playerName
) {}