package com.trivia.event;

import java.time.Instant;

public sealed interface DomainEvent permits QuizStarted, AnswerSubmitted, QuizCompleted {
    String sessionId();
    Instant occurredAt();
}