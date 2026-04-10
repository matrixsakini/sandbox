package com.trivia.service;

import com.trivia.event.AnswerSubmitted;
import com.trivia.event.QuizCompleted;
import com.trivia.event.QuizStarted;
import com.trivia.exception.SessionNotFoundException;
import com.trivia.messaging.EventPublisher;
import com.trivia.model.*;
import com.trivia.question.QuestionService;
import com.trivia.repository.LeaderboardRepository;
import com.trivia.repository.SessionRepository;
import com.trivia.config.QuizProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class QuizService {

    private static final Logger log = LoggerFactory.getLogger(QuizService.class);

    private final QuestionService questionService;
    private final SessionRepository sessionRepository;
    private final LeaderboardRepository leaderboardRepository;
    private final EventPublisher eventPublisher;
    private final QuizProperties props;

    public QuizService(QuestionService questionService,
                       SessionRepository sessionRepository,
                       LeaderboardRepository leaderboardRepository,
                       EventPublisher eventPublisher,
                       QuizProperties props) {
        this.questionService = questionService;
        this.sessionRepository = sessionRepository;
        this.leaderboardRepository = leaderboardRepository;
        this.eventPublisher = eventPublisher;
        this.props = props;
    }

    public Mono<QuizSession> startQuiz(String topic, String playerName) {
        log.info("Starting quiz: player={}, topic={}", playerName, topic);
        return questionService.fetchQuestions(topic, props.questionsPerQuiz())
                .collectList()
                .map(questions -> new QuizSession(
                        UUID.randomUUID().toString(),
                        playerName,
                        topic,
                        questions,
                        List.of(),
                        Instant.now(),
                        QuizStatus.IN_PROGRESS))
                .flatMap(sessionRepository::save)
                .flatMap(session -> eventPublisher
                        .publish(new QuizStarted(
                                session.sessionId(),
                                playerName,
                                topic,
                                session.questions().size(),
                                Instant.now()))
                        .thenReturn(session))
                .doOnNext(session -> log.info("Quiz started: sessionId={}, questions={}",
                        session.sessionId(), session.questions().size()));
    }

    public Mono<QuizSession> getSession(String sessionId) {
        log.debug("Fetching session: sessionId={}", sessionId);
        return sessionRepository.findById(sessionId)
                .switchIfEmpty(Mono.error(new SessionNotFoundException(sessionId)))
                .contextWrite(ctx -> ctx.put("sessionId", sessionId));
    }

    public Mono<QuizSession> submitAnswer(String sessionId, String questionId, int chosenIndex) {
        log.info("Submitting answer: sessionId={}, questionId={}, chosenIndex={}", sessionId, questionId, chosenIndex);
        return sessionRepository.findById(sessionId)
                .switchIfEmpty(Mono.error(new SessionNotFoundException(sessionId)))
                .flatMap(session -> {
                    boolean alreadyAnswered = session.answers().stream()
                            .anyMatch(a -> a.questionId().equals(questionId));
                    if (alreadyAnswered) {
                        return Mono.error(new IllegalArgumentException("Question already answered: " + questionId));
                    }
                    var question = findQuestion(session, questionId);
                    boolean correct = question.correctIndex() == chosenIndex;
                    int points = correct ? computePoints(question) : 0;
                    log.info("Answer scored: sessionId={}, questionId={}, correct={}, points={}",
                            sessionId, questionId, correct, points);
                    var answer = new SubmittedAnswer(questionId, chosenIndex, correct, points, Instant.now());
                    var updated = session.withAnswer(answer);
                    return sessionRepository.save(updated)
                            .flatMap(saved -> publishAndFinalize(saved, answer));
                })
                .contextWrite(ctx -> ctx.put("sessionId", sessionId));
    }

    public Flux<LeaderboardEntry> getLeaderboard(String topic, int top) {
        log.debug("Fetching leaderboard: topic={}, top={}", topic, top);
        return leaderboardRepository.topScores(topic, top);
    }

    private Question findQuestion(QuizSession session, String questionId) {
        return session.questions().stream()
                .filter(q -> q.id().equals(questionId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));
    }

    private int computePoints(Question question) {
        return switch (question.difficulty()) {
            case EASY -> 10;
            case MEDIUM -> 20;
            case HARD -> 30;
        };
    }

    private Mono<QuizSession> publishAndFinalize(QuizSession session, SubmittedAnswer answer) {
        Mono<Void> publishAnswer = eventPublisher.publish(new AnswerSubmitted(
                session.sessionId(), answer.questionId(), answer.correct(), answer.points(), Instant.now()));

        if (session.status() == QuizStatus.COMPLETED) {
            int totalScore = session.totalScore();
            int maxScore = session.questions().stream().mapToInt(this::computePoints).sum();
            log.info("Quiz completed: sessionId={}, player={}, score={}/{}",
                    session.sessionId(), session.playerName(), totalScore, maxScore);

            Instant completedAt = Instant.now();
            Mono<Void> recordScore = leaderboardRepository
                    .recordScore(session.topic(), session.playerName(), totalScore, completedAt)
                    .then();
            Mono<Void> publishCompleted = eventPublisher.publish(new QuizCompleted(
                    session.sessionId(), session.playerName(), session.topic(),
                    totalScore, maxScore, Instant.now()));

            return publishAnswer.then(recordScore).then(publishCompleted).thenReturn(session);
        }

        return publishAnswer.thenReturn(session);
    }
}