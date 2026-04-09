package com.trivia.dto;

import com.trivia.model.Question;
import com.trivia.model.QuizSession;
import com.trivia.model.SubmittedAnswer;

import java.util.Set;
import java.util.stream.Collectors;

public record QuizSessionDto(
        String sessionId,
        String topic,
        String playerName,
        String status,
        CurrentQuestionDto currentQuestion,
        int questionsRemaining,
        int score
) {
    public static QuizSessionDto from(QuizSession session) {
        Set<String> answeredIds = session.answers().stream()
                .map(SubmittedAnswer::questionId)
                .collect(Collectors.toSet());

        Question next = session.questions().stream()
                .filter(q -> !answeredIds.contains(q.id()))
                .findFirst()
                .orElse(null);

        int remaining = (int) session.questions().stream()
                .filter(q -> !answeredIds.contains(q.id()))
                .count();

        return new QuizSessionDto(
                session.sessionId(),
                session.topic(),
                session.playerName(),
                session.status().name(),
                next != null ? CurrentQuestionDto.from(next) : null,
                remaining,
                session.totalScore());
    }
}