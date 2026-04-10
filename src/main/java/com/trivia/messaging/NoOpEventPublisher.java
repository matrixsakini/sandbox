package com.trivia.messaging;

import com.trivia.event.DomainEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
@ConditionalOnProperty(prefix = "trivia", name = "kafka-enabled", havingValue = "false", matchIfMissing = true)
public class NoOpEventPublisher implements EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(NoOpEventPublisher.class);

    @Override
    public Mono<Void> publish(DomainEvent event) {
        log.debug("Event dropped (Kafka disabled): type={}, sessionId={}",
                event.getClass().getSimpleName(), event.sessionId());
        return Mono.empty();
    }
}