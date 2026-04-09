package com.trivia.event;

import java.time.Instant;

public record AnswerSubmitted(
        String sessionId,
        String questionId,
        boolean correct,
        int pointsAwarded,
        Instant occurredAt
) implements DomainEvent {}