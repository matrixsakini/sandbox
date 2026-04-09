# Trivia Service

A reactive, event-driven trivia quiz backend built for the Picnic Backend Engineering Assessment (April 2026).

## Tech Stack

- **Java 21** — records, sealed interfaces, pattern matching
- **Spring Boot 3.4** + **Spring WebFlux** (Reactor) — non-blocking, reactive end-to-end
- **Redis** (Lettuce reactive) — session state with TTL, leaderboard via ZSET
- **Kafka** (reactor-kafka) — domain event publishing
- **Maven**

## Diagrams

- [System Diagram](docs/system-diagram.md)
- [Sequence Diagram](docs/sequence-diagram.md)

## Architecture

Layered (N-Tier):

```
com.trivia
├── controller/     QuizController, GlobalExceptionHandler
├── service/        QuizService
├── repository/     SessionRepository, LeaderboardRepository  (Redis)
├── messaging/      KafkaEventPublisher
├── question/       QuestionService  (loads questions.json)
├── model/          QuizSession, Question, SubmittedAnswer, LeaderboardEntry, ...
├── event/          DomainEvent (sealed), QuizStarted, AnswerSubmitted, QuizCompleted
├── exception/      SessionNotFoundException
├── dto/            StartQuizRequest, SubmitAnswerRequest, QuizSessionDto, AnswerResultDto, ...
├── filter/         TransactionIdWebFilter
└── config/         RedisConfig, KafkaConfig, MdcContextPropagator, QuizProperties
```

Each layer has a single responsibility:
- **controller** handles HTTP in/out and delegates to the service
- **service** contains all business logic
- **repository** owns Redis reads/writes
- **messaging** owns Kafka publishing

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/quizzes` | Start a quiz (`{ topic, playerName }`) |
| `GET` | `/api/v1/quizzes/{id}` | Get session state |
| `POST` | `/api/v1/quizzes/{id}/answers` | Submit an answer (`{ questionId, chosenIndex }`) |
| `GET` | `/api/v1/leaderboard?topic=&top=10` | Get top scores for a topic |
| `GET` | `/actuator/health` | Health check |

Errors follow [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807).

## Scoring

Points are difficulty-weighted per question: **EASY = 10**, **MEDIUM = 20**, **HARD = 30**.

## Running Locally

**1. Start infrastructure**

```bash
docker compose up -d
```

**2. Run the app**

```bash
mvn spring-boot:run
```

The app connects to Redis on `localhost:6379` and Kafka on `localhost:9092` by default. Override via environment variables:

```bash
REDIS_HOST=myredis KAFKA_BOOTSTRAP=mykafka:9092 mvn spring-boot:run
```

## Running Tests

```bash
mvn test           # unit tests only (no infrastructure required)
mvn verify         # unit + integration tests
```

## Question Bank (Phase 1)

Static questions are loaded from `src/main/resources/questions.json` at startup.
Available topics: **science**, **history**, **technology** (10 questions each).

## Phase 2: LLM Question Generation

A future `LlmQuestionService` can be added alongside `QuestionService`, calling an external LLM API
(e.g. Anthropic Claude) to generate questions dynamically. `QuizService` can be updated to route
to the appropriate service based on topic or configuration.