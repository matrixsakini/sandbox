package com.trivia.repository;

import com.trivia.model.LeaderboardEntry;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

@Repository
public class LeaderboardRepository {

    private final ReactiveStringRedisTemplate stringRedisTemplate;

    public LeaderboardRepository(ReactiveStringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public Mono<Boolean> recordScore(String topic, String playerName, int score, Instant completedAt) {
        String leaderKey = leaderboardKey(topic);
        String timesKey  = timesKey(topic);
        return stringRedisTemplate.opsForZSet()
                .score(leaderKey, playerName)
                .defaultIfEmpty(Double.NEGATIVE_INFINITY)
                .flatMap(current -> {
                    if (score <= current) return Mono.just(false);
                    return stringRedisTemplate.opsForZSet()
                            .add(leaderKey, playerName, score)
                            .flatMap(added -> stringRedisTemplate.<String, String>opsForHash()
                                    .put(timesKey, playerName, completedAt.toString()));
                });
    }

    public Flux<LeaderboardEntry> topScores(String topic, int limit) {
        AtomicInteger rank = new AtomicInteger(1);
        String timesKey = timesKey(topic);
        return stringRedisTemplate.opsForZSet()
                .reverseRangeWithScores(leaderboardKey(topic), org.springframework.data.domain.Range.unbounded())
                .take(limit)
                .filter(tuple -> tuple.getValue() != null)
                .flatMapSequential(tuple -> {
                    String playerName = tuple.getValue();
                    double score = tuple.getScore() != null ? tuple.getScore() : 0.0;
                    int r = rank.getAndIncrement();
                    return stringRedisTemplate.opsForHash()
                            .get(timesKey, playerName)
                            .map(ts -> new LeaderboardEntry(r, playerName, score, Instant.parse(ts.toString())))
                            .defaultIfEmpty(new LeaderboardEntry(r, playerName, score, null));
                });
    }

    private String leaderboardKey(String topic) {
        return "leaderboard:" + topic.toLowerCase();
    }

    private String timesKey(String topic) {
        return "leaderboard:" + topic.toLowerCase() + ":times";
    }
}