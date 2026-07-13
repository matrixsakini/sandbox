package com.trivia.repository;

import com.trivia.config.ChoreProperties;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Chore marks live in one Redis hash per ISO week (field: "{choreId}:{personIndex}"),
 * so a new week starts from an empty board and old boards expire via TTL.
 */
@Repository
public class ChoreBoardRepository {

    private final ReactiveStringRedisTemplate redisTemplate;
    private final ChoreProperties props;

    public ChoreBoardRepository(ReactiveStringRedisTemplate redisTemplate, ChoreProperties props) {
        this.redisTemplate = redisTemplate;
        this.props = props;
    }

    public Mono<Map<String, String>> findMarks(String weekId) {
        return redisTemplate.<String, String>opsForHash().entries(key(weekId))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    public Mono<Void> setMark(String weekId, String field, boolean done) {
        String key = key(weekId);
        Mono<?> write = done
                ? redisTemplate.<String, String>opsForHash().put(key, field, "1")
                : redisTemplate.<String, String>opsForHash().remove(key, field);
        return write
                .then(redisTemplate.expire(key, props.boardTtl()))
                .then();
    }

    private String key(String weekId) {
        return "chores:" + weekId;
    }
}
