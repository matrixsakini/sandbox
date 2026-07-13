package com.trivia.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "chores")
public record ChoreProperties(
        List<String> people,
        List<Chore> list,
        Duration boardTtl,
        String zone
) {
    public record Chore(String id, String label) {}
}
