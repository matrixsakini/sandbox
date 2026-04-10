package com.trivia.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trivia.event.AnswerSubmitted;
import com.trivia.event.DomainEvent;
import com.trivia.event.QuizCompleted;
import com.trivia.event.QuizStarted;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.kafka.sender.KafkaSender;
import reactor.kafka.sender.SenderRecord;

@Component
@ConditionalOnProperty(prefix = "trivia", name = "kafka-enabled", havingValue = "true")
public class KafkaEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(KafkaEventPublisher.class);

    private final KafkaSender<String, String> kafkaSender;
    private final ObjectMapper objectMapper;

    public KafkaEventPublisher(KafkaSender<String, String> kafkaSender, ObjectMapper objectMapper) {
        this.kafkaSender = kafkaSender;
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> publish(DomainEvent event) {
        return Mono.fromCallable(() -> objectMapper.writeValueAsString(event))
                .flatMap(json -> kafkaSender.send(Mono.just(
                        SenderRecord.create(
                                new ProducerRecord<>(topicFor(event), event.sessionId(), json),
                                event.sessionId())))
                        .then())
                .doOnError(e -> log.error("Failed to publish event {}: {}", event.getClass().getSimpleName(), e.getMessage()))
                .onErrorComplete();
    }

    private String topicFor(DomainEvent event) {
        return switch (event) {
            case QuizStarted __ -> "trivia.events.quiz-started";
            case AnswerSubmitted __ -> "trivia.events.answer-submitted";
            case QuizCompleted __ -> "trivia.events.quiz-completed";
        };
    }
}