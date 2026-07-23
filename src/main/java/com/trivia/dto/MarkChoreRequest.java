package com.trivia.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MarkChoreRequest(
        @NotBlank String choreId,
        @NotNull Integer person,
        @NotNull Boolean done
) {}
