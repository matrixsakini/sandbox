package com.trivia.repository;

import com.trivia.model.LeaderboardEntry;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicInteger;

@Repository
public class LeaderboardRepository {

    private final ReactiveRedisTemplate<String, String> stringRedisTemplate;

    public LeaderboardRepository(ReactiveRedisTemplate<String, String> stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public Mono<Boolean> recordScore(String topic, String playerName, int score) {
        return stringRedisTemplate.opsForZSet()
                .incrementScore(leaderboardKey(topic), playerName, score)
                .map(newScore -> true);
    }

    public Flux<LeaderboardEntry> topScores(String topic, int limit) {
        AtomicInteger rank = new AtomicInteger(1);
        return stringRedisTemplate.opsForZSet()
                .reverseRangeWithScores(leaderboardKey(topic), org.springframework.data.domain.Range.unbounded())
                .take(limit)
                .map(tuple -> new LeaderboardEntry(
                        rank.getAndIncrement(),
                        tuple.getValue(),
                        tuple.getScore() != null ? tuple.getScore() : 0.0));
    }

    private String leaderboardKey(String topic) {
        return "leaderboard:" + topic.toLowerCase();
    }
}