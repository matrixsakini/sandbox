package com.trivia.model;

public record LeaderboardEntry(
        int rank,
        String playerName,
        double score,
        java.time.Instant completedAt
) {}