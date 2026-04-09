package com.trivia.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "trivia")
public record QuizProperties(
        int questionsPerQuiz,
        int answerTimeoutSeconds,
        Duration activeSessionTtl,
        Duration completedSessionTtl
) {}