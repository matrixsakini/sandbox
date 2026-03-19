package com.example.sandbox;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.reactive.server.WebTestClient;

@WebFluxTest
@Import({HelloRouter.class, HelloHandler.class})
class HelloRouterTest {

    @Autowired
    WebTestClient client;

    @Test
    void helloReturnsDefaultGreeting() {
        client.get().uri("/hello")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class).isEqualTo("Hello, World!");
    }

    @Test
    void helloReturnsNamedGreeting() {
        client.get().uri("/hello?name=Alice")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class).isEqualTo("Hello, Alice!");
    }
}