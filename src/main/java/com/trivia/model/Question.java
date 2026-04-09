package com.trivia.model;

import java.util.List;

public record Question(
        String id,
        String topic,
        String text,
        List<String> options,
        int correctIndex,
        Difficulty difficulty
) {}