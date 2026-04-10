package com.trivia.messaging;

import com.trivia.event.DomainEvent;
import reactor.core.publisher.Mono;

public interface EventPublisher {
    Mono<Void> publish(DomainEvent event);
}