package com.trivia.service;

import com.trivia.config.QuizProperties;
import com.trivia.event.DomainEvent;
import com.trivia.event.QuizStarted;
import com.trivia.messaging.EventPublisher;
import com.trivia.model.*;
import com.trivia.question.QuestionService;
import com.trivia.repository.LeaderboardRepository;
import com.trivia.repository.SessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock QuestionService questionService;
    @Mock SessionRepository sessionRepository;
    @Mock LeaderboardRepository leaderboardRepository;
    @Mock EventPublisher kafkaEventPublisher;

    QuizService quizService;

    QuizProperties props = new QuizProperties(5, 30,
            Duration.ofMinutes(30), Duration.ofMinutes(5), false);

    @BeforeEach
    void setUp() {
        quizService = new QuizService(questionService, sessionRepository, leaderboardRepository, kafkaEventPublisher, props);
    }

    @Test
    void startQuiz_createsSessionAndPublishesEvent() {
        List<Question> questions = List.of(
                new Question("q1", "science", "What is 2+2?", List.of("3", "4", "5", "6"), 1, Difficulty.EASY)
        );

        when(questionService.fetchQuestions("science", 5)).thenReturn(Flux.fromIterable(questions));
        when(sessionRepository.save(any())).thenAnswer(inv -> Mono.just(inv.getArgument(0)));
        when(kafkaEventPublisher.publish(any())).thenReturn(Mono.empty());

        StepVerifier.create(quizService.startQuiz("science", "jane"))
                .assertNext(session -> {
                    assertThat(session.playerName()).isEqualTo("jane");
                    assertThat(session.topic()).isEqualTo("science");
                    assertThat(session.status()).isEqualTo(QuizStatus.IN_PROGRESS);
                    assertThat(session.questions()).hasSize(1);
                    assertThat(session.answers()).isEmpty();
                })
                .verifyComplete();

        ArgumentCaptor<DomainEvent> eventCaptor = ArgumentCaptor.forClass(DomainEvent.class);
        verify(kafkaEventPublisher).publish(eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(QuizStarted.class);
    }

    @Test
    void domainEvents_includeOccurredAtInPayload() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper()
                .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

        QuizStarted event = new QuizStarted("sess-1", "jane", "science", 5, Instant.now());
        String json = objectMapper.writeValueAsString(event);

        assertThat(event.occurredAt()).isNotNull();
        assertThat(json).contains("occurredAt");
    }

    @Test
    void submitAnswer_correctAnswer_awardsPoints() {
        Question question = new Question("q1", "science", "What is 2+2?",
                List.of("3", "4", "5", "6"), 1, Difficulty.EASY);

        QuizSession session = new QuizSession("sess-1", "jane", "science",
                List.of(question), List.of(), Instant.now(), QuizStatus.IN_PROGRESS);

        when(sessionRepository.findById("sess-1")).thenReturn(Mono.just(session));
        when(sessionRepository.save(any())).thenAnswer(inv -> Mono.just(inv.getArgument(0)));
        when(kafkaEventPublisher.publish(any())).thenReturn(Mono.empty());
        when(leaderboardRepository.recordScore(anyString(), anyString(), anyInt(), any(Instant.class))).thenReturn(Mono.just(true));

        StepVerifier.create(quizService.submitAnswer("sess-1", "q1", 1))
                .assertNext(updated -> {
                    assertThat(updated.answers()).hasSize(1);
                    assertThat(updated.answers().getFirst().correct()).isTrue();
                    assertThat(updated.answers().getFirst().points()).isEqualTo(10);
                    assertThat(updated.status()).isEqualTo(QuizStatus.COMPLETED);
                    assertThat(updated.totalScore()).isEqualTo(10);
                })
                .verifyComplete();
    }

    @Test
    void submitAnswer_duplicateQuestion_returnsError() {
        Question question = new Question("q1", "science", "What is 2+2?",
                List.of("3", "4", "5", "6"), 1, Difficulty.EASY);

        SubmittedAnswer previous = new SubmittedAnswer("q1", 1, true, 10, Instant.now());
        QuizSession session = new QuizSession("sess-1", "jane", "science",
                List.of(question), List.of(previous), Instant.now(), QuizStatus.IN_PROGRESS);

        when(sessionRepository.findById("sess-1")).thenReturn(Mono.just(session));

        StepVerifier.create(quizService.submitAnswer("sess-1", "q1", 1))
                .expectErrorMatches(e -> e instanceof IllegalArgumentException
                        && e.getMessage().contains("already answered"))
                .verify();
    }

    @Test
    void submitAnswer_wrongAnswer_awardsNoPoints() {
        Question question = new Question("q1", "science", "What is 2+2?",
                List.of("3", "4", "5", "6"), 1, Difficulty.MEDIUM);

        QuizSession session = new QuizSession("sess-1", "jane", "science",
                List.of(question), List.of(), Instant.now(), QuizStatus.IN_PROGRESS);

        when(sessionRepository.findById("sess-1")).thenReturn(Mono.just(session));
        when(sessionRepository.save(any())).thenAnswer(inv -> Mono.just(inv.getArgument(0)));
        when(kafkaEventPublisher.publish(any())).thenReturn(Mono.empty());
        when(leaderboardRepository.recordScore(anyString(), anyString(), anyInt(), any(Instant.class))).thenReturn(Mono.just(true));

        StepVerifier.create(quizService.submitAnswer("sess-1", "q1", 0))
                .assertNext(updated -> {
                    assertThat(updated.answers().getFirst().correct()).isFalse();
                    assertThat(updated.answers().getFirst().points()).isZero();
                })
                .verifyComplete();
    }
}