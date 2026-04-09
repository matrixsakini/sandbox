package com.trivia.repository;

import com.trivia.config.QuizProperties;
import com.trivia.model.QuizSession;
import com.trivia.model.QuizStatus;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Repository
public class SessionRepository {

    private final ReactiveRedisTemplate<String, QuizSession> redisTemplate;
    private final QuizProperties props;

    public SessionRepository(ReactiveRedisTemplate<String, QuizSession> redisTemplate,
                             QuizProperties props) {
        this.redisTemplate = redisTemplate;
        this.props = props;
    }

    public Mono<QuizSession> save(QuizSession session) {
        Duration ttl = session.status() == QuizStatus.COMPLETED
                ? props.completedSessionTtl()
                : props.activeSessionTtl();
        return redisTemplate.opsForValue()
                .set(key(session.sessionId()), session, ttl)
                .thenReturn(session);
    }

    public Mono<QuizSession> findById(String sessionId) {
        return redisTemplate.opsForValue().get(key(sessionId));
    }

    private String key(String sessionId) {
        return "session:" + sessionId;
    }
}