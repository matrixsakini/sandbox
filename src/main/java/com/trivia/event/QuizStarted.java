package com.trivia.event;

import java.time.Instant;

public record QuizStarted(
        String sessionId,
        String playerName,
        String topic,
        int questionCount,
        Instant occurredAt
) implements DomainEvent {}