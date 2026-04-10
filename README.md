# Trivia Service

A reactive, event-driven trivia quiz backend built for the Picnic Backend Engineering Assessment (April 2026).

## Tech Stack

- **Java 21** — records, sealed interfaces, pattern matching
- **Spring Boot 3.4** + **Spring WebFlux** (Reactor) — non-blocking, reactive end-to-end
- **Redis** (Lettuce reactive) — session state with TTL, leaderboard via ZSET
- **Kafka** (reactor-kafka) — optional domain event publishing (disabled by default)
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
├── messaging/      EventPublisher (interface), KafkaEventPublisher, NoOpEventPublisher
├── question/       QuestionService  (loads questions/*.json)
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
- **messaging** owns event publishing — `KafkaEventPublisher` when Kafka is enabled, `NoOpEventPublisher` otherwise

## Kafka

Kafka publishing is **optional** and controlled by the `trivia.kafka-enabled` property (env: `TRIVIA_KAFKA_ENABLED`).

| `TRIVIA_KAFKA_ENABLED` | Behaviour |
|------------------------|-----------|
| `false` (default) | `NoOpEventPublisher` — events are dropped and debug-logged |
| `true` | `KafkaEventPublisher` — events sent to `trivia.events.*` topics |

When enabled, set `KAFKA_BOOTSTRAP` to point to your broker (default: `localhost:9092`).

Topics: `trivia.events.quiz-started`, `trivia.events.answer-submitted`, `trivia.events.quiz-completed`

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/quizzes` | Start a quiz (`{ topic, playerName }`) |
| `GET` | `/api/v1/quizzes/{id}` | Get session state |
| `POST` | `/api/v1/quizzes/{id}/answers` | Submit an answer (`{ questionId, chosenIndex }`) |
| `GET` | `/api/v1/leaderboard?topic=&top=10` | Get top scores for a topic |
| `GET` | `/actuator/health` | Health check |
| `GET` | `/swagger-ui.html` | Interactive API docs |

Errors follow [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807).

## Scoring

Points are difficulty-weighted per question: **EASY = 10**, **MEDIUM = 20**, **HARD = 30**.

## Running Locally

**1. Start infrastructure and app**

```bash
docker compose up
```

This starts Redis and the app (Kafka is disabled by default). The app is available at `http://localhost:8080`.

**2. Run the app standalone** (if you prefer running outside Docker)

```bash
docker compose up -d redis
mvn spring-boot:run
```

Redis is configured via `REDIS_URL` (default: `redis://localhost:6379`):

```bash
REDIS_URL=redis://myredis:6379 mvn spring-boot:run
```

**With Kafka enabled:**

```bash
docker compose up -d redis
TRIVIA_KAFKA_ENABLED=true KAFKA_BOOTSTRAP=localhost:9092 mvn spring-boot:run
```

## Running Tests

```bash
mvn test                  # unit tests only — no infrastructure required
```

**E2E tests (Cucumber)** require Redis to be running:

```bash
docker compose up -d redis
mvn verify -P integration  # unit + E2E
```

E2E tests start the full Spring context on a random port and run all scenarios in `src/test/resources/features/` against a real Redis instance.

## Deployment (Render + Upstash)

The repo includes a `render.yaml` Blueprint and a `Dockerfile` for one-click Render deployment.

**Prerequisites:**
1. Create a free Redis instance at [upstash.com](https://upstash.com) — copy the `rediss://...` connection URL

**Deploy:**
1. Push this repo to GitHub
2. In Render: **New → Blueprint** → select this repo
3. Set the `REDIS_URL` environment variable in the Render dashboard to your Upstash URL
4. Deploy — Render builds the Docker image automatically

The free tier spins down after 15 minutes of inactivity. Expect a ~30s cold start on first request after idle.

## Question Bank (Phase 1)

Static questions are loaded from `src/main/resources/questions/` at startup (one JSON file per topic, auto-discovered).
Available topics: **science**, **history**, **technology**, **modern-java**, **design-patterns**, **reactor** (10 questions each).

## Phase 2: LLM Question Generation

A future `LlmQuestionService` can be added alongside `QuestionService`, calling an external LLM API
(e.g. Anthropic Claude) to generate questions dynamically. `QuizService` can be updated to route
to the appropriate service based on topic or configuration.