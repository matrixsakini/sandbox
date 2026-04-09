package com.trivia.event;

import java.time.Instant;

public record QuizCompleted(
        String sessionId,
        String playerName,
        String topic,
        int totalScore,
        int maxScore,
        Instant occurredAt
) implements DomainEvent {}