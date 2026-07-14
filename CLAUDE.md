# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three independent components share this repo — changes to one never require touching the others:

- **`src/` + `pom.xml`** — the Trivia Service: a reactive Spring Boot quiz backend (the main project, detailed below)
- **`moon-merge/`** — standalone browser merge-puzzle game (vanilla JS, no build step; has its own CLAUDE.md)
- **`moon-slash/`** — standalone browser slashing game (vanilla JS, no build step; has its own CLAUDE.md)

`render.yaml` deploys these to Render (backend as a Docker web service, games as static sites).

## Trivia Service

Java 21 (records, sealed interfaces) + Spring Boot 3.4 with WebFlux. Everything is non-blocking end-to-end: controllers return `Mono`/`Flux`, Redis access uses reactive Lettuce, Kafka uses reactor-kafka. Never introduce blocking calls in the request path.

### Commands

```bash
mvn test                                   # unit tests only, no infrastructure needed
mvn test -Dtest=QuizServiceTest            # single test class
mvn test -Dtest=QuizServiceTest#methodName # single test method

docker compose up -d redis                 # E2E tests require Redis
mvn verify -P integration                  # unit + Cucumber E2E (classes named *IT)

mvn spring-boot:run                        # run the app (needs Redis; http://localhost:8080)
docker compose up                          # run Redis + app together
```

Surefire excludes `**/*IT.java`; the `integration` profile adds failsafe to run them. E2E scenarios live in `src/test/resources/features/` (Gherkin) with step definitions in `src/test/java/com/trivia/e2e/steps/`; they boot the full Spring context on a random port against real Redis.

`DEV_CHEATSHEET.md` has curl examples for every endpoint plus Redis/Kafka inspection commands. Swagger UI at `/swagger-ui.html`.

### Architecture

Layered flow: `QuizController` → `QuizService` (all business logic) → repositories + `EventPublisher`. Packages under `com.trivia` map one-to-one to layers (see README for the full tree).

Key cross-cutting facts that span multiple files:

- **State lives only in Redis.** `SessionRepository` stores `QuizSession` JSON at `session:{id}` with a TTL that depends on status (active 30m / completed 5m, from `QuizProperties`). `LeaderboardRepository` uses a ZSET `leaderboard:{topic}` (best score per player) plus a hash of completion times. There is no SQL database.
- **`QuizSession` is an immutable record** — mutations create a new instance and re-save, which resets the TTL.
- **Kafka is optional and swapped by property.** `trivia.kafka-enabled` (`TRIVIA_KAFKA_ENABLED`, default `false`) selects between `KafkaEventPublisher` and `NoOpEventPublisher` via `@ConditionalOnProperty` on the shared `EventPublisher` interface. Domain events (`DomainEvent` sealed interface: `QuizStarted`, `AnswerSubmitted`, `QuizCompleted`) go to `trivia.events.*` topics.
- **Questions are static JSON**, one file per topic in `src/main/resources/questions/`, auto-discovered by `QuestionService` at startup. Adding a topic = adding a JSON file. Scoring is difficulty-weighted: EASY 10, MEDIUM 20, HARD 30.
- **Config knobs** (questions per quiz, answer timeout, TTLs) live in `application.yml` under `trivia.*`, bound to the `QuizProperties` record.
- **Observability:** `TransactionIdWebFilter` assigns a transaction ID per request and `MdcContextPropagator` carries it (and `sessionId`) through Reactor contexts into the JSON log output. Errors are RFC 7807 Problem Details via `GlobalExceptionHandler`.
