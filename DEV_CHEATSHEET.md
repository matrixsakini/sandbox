# Trivia Service — Dev Cheat Sheet

## Service Info

| Property | Value |
|---|---|
| Base URL | `http://localhost:8080` |
| Topics | `science`, `history`, `technology` |
| Questions per topic | 10 (30 total) |
| Questions per quiz | 10 |
| Answer timeout | 30 s |
| Active session TTL | 30 min |
| Completed session TTL | 5 min |

---

## Browser Links

| Link | URL |
|---|---|
| Swagger UI | [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) |
| OpenAPI JSON | [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs) |
| Health | [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) |
| Liveness | [http://localhost:8080/actuator/health/liveness](http://localhost:8080/actuator/health/liveness) |
| Readiness | [http://localhost:8080/actuator/health/readiness](http://localhost:8080/actuator/health/readiness) |
| Info | [http://localhost:8080/actuator/info](http://localhost:8080/actuator/info) |
| Metrics | [http://localhost:8080/actuator/metrics](http://localhost:8080/actuator/metrics) |
| Prometheus | [http://localhost:8080/actuator/prometheus](http://localhost:8080/actuator/prometheus) |

> **Note:** actuator exposure is currently set to `lin` in `application.yml`. Add the ones you need:
> ```yaml
> management.endpoints.web.exposure.include: health,info,metrics,prometheus
> ```

---

## Start Infrastructure

```bash
docker-compose up -d
```

---

## Redis Commands

> No redis-cli installed? Use Docker: `docker compose exec redis redis-cli`

```bash
# Connect (via docker if redis-cli not installed locally)
docker compose exec redis redis-cli
redis-cli -h localhost -p 6379

# Count active/completed sessions
docker compose exec redis redis-cli keys "session:*" | wc -l

# List all session keys
docker compose exec redis redis-cli keys "session:*"

# Inspect a specific session
docker compose exec redis redis-cli get "session:<session-id>"

# Watch all session writes in real time
docker compose exec redis redis-cli monitor

# Flush all data (careful!)
docker compose exec redis redis-cli flushall
```

---

## Kafka Commands

> No kafka-topics installed? Use Docker: `docker compose exec kafka <command>`

```bash
# List all topics
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Describe trivia topics
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic trivia.events.quiz-started
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic trivia.events.answer-submitted
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic trivia.events.quiz-completed

# Consume events from the beginning
docker compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic trivia.events.quiz-started    --from-beginning
docker compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic trivia.events.answer-submitted --from-beginning
docker compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic trivia.events.quiz-completed   --from-beginning

# Count messages in a topic
docker compose exec kafka kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic trivia.events.quiz-completed \
  --time -1
```

---

## API Quick Reference

### Start a quiz
```bash
curl -s -X POST http://localhost:8080/api/v1/quizzes \
  -H "Content-Type: application/json" \
  -d '{"playerName": "alice", "topic": "science"}' | jq .
```

### Get session state
```bash
curl -s http://localhost:8080/api/v1/quizzes/<session-id> | jq .
```

### Submit an answer
```bash
curl -s -X POST http://localhost:8080/api/v1/quizzes/<session-id>/answers \
  -H "Content-Type: application/json" \
  -d '{"questionId": "<question-id>", "chosenIndex": 1}' | jq .
```

### Get leaderboard
```bash
# topic: science | history | technology
curl -s "http://localhost:8080/api/v1/leaderboard?topic=science&top=10" | jq .
```

---

## Questions Breakdown

| Topic | Total | Easy | Medium | Hard |
|---|---|---|---|---|
| science | 10 | 4 | 4 | 2 |
| history | 10 | 3 | 5 | 2 |
| technology | 10 | 3 | 4 | 3 |
| **Total** | **30** | **10** | **13** | **7** |