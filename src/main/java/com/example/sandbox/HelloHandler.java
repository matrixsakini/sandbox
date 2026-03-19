package com.example.sandbox;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

@Component
public class HelloHandler {

    public Mono<ServerResponse> hello(ServerRequest request) {
        String name = request.queryParam("name").orElse("World");
        return ServerResponse.ok()
                .bodyValue("Hello, " + name + "!");
    }
}