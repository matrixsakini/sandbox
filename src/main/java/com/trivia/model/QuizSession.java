package com.trivia.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public record QuizSession(
        String sessionId,
        String playerName,
        String topic,
        List<Question> questions,
        List<SubmittedAnswer> answers,
        Instant startedAt,
        QuizStatus status
) {
    public QuizSession withAnswer(SubmittedAnswer answer) {
        var updated = new ArrayList<>(answers);
        updated.add(answer);
        var newStatus = updated.size() == questions.size()
                ? QuizStatus.COMPLETED : QuizStatus.IN_PROGRESS;
        return new QuizSession(sessionId, playerName, topic,
                questions, List.copyOf(updated), startedAt, newStatus);
    }

    public int totalScore() {
        return answers.stream().mapToInt(SubmittedAnswer::points).sum();
    }
}