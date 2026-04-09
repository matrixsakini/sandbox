package com.trivia.dto;

import com.trivia.model.Question;

import java.util.List;

public record CurrentQuestionDto(String id, String text, List<String> options) {

    public static CurrentQuestionDto from(Question question) {
        return new CurrentQuestionDto(question.id(), question.text(), question.options());
    }
}