package com.trivia.model;

import java.time.Instant;

public record SubmittedAnswer(
        String questionId,
        int chosenIndex,
        boolean correct,
        int points,
        Instant submittedAt
) {}