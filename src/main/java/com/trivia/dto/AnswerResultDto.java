package com.trivia.dto;

import com.trivia.model.QuizSession;
import com.trivia.model.SubmittedAnswer;

public record AnswerResultDto(
        String questionId,
        boolean correct,
        int pointsAwarded,
        int totalScore,
        String sessionStatus,
        CurrentQuestionDto nextQuestion
) {
    public static AnswerResultDto from(QuizSession session, SubmittedAnswer answer) {
        QuizSessionDto sessionDto = QuizSessionDto.from(session);
        return new AnswerResultDto(
                answer.questionId(),
                answer.correct(),
                answer.points(),
                session.totalScore(),
                session.status().name(),
                sessionDto.currentQuestion());
    }
}