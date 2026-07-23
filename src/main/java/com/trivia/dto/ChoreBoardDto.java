package com.trivia.dto;

import java.util.List;

public record ChoreBoardDto(
        String weekId,
        String weekStart,
        String weekEnd,
        List<String> people,
        List<ChoreDto> chores
) {
    public record ChoreDto(String id, String label, List<Boolean> done) {}
}
