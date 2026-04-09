# How to Play Trivia Service

## Prerequisites

- Docker Desktop running
- Java 21

---

## 1. Start Infrastructure

```bash
docker compose up -d
```

This starts Redis and Kafka locally. Wait a few seconds for Kafka to become healthy.

---

## 2. Start the App

```bash
mvn spring-boot:run
```

The app is ready when you see:

```
Started TriviaApplication in X seconds
```

---

## 3. Open Swagger UI

Go to **http://localhost:8080/swagger-ui.html** in your browser.

You'll see two sections:
- **Quiz** — start a game, submit answers, check session state
- **Leaderboard** — view top scores by topic

---

## 4. Start a Quiz

1. Expand **POST /api/v1/quizzes** → click **Try it out**
2. Fill in the request body:
   ```json
   { "topic": "science", "playerName": "jane" }
   ```
   Available topics: `science`, `history`, `technology`
3. Click **Execute**
4. Copy the `sessionId` and the current `currentQuestion.id` from the response

---

## 5. Submit an Answer

1. Expand **POST /api/v1/quizzes/{id}/answers** → click **Try it out**
2. Enter your `sessionId` in the `id` field
3. Fill in the request body — options are **0-indexed**:
   ```json
   { "questionId": "{questionId}", "chosenIndex": 0 }
   ```
4. Click **Execute**
5. Check `correct` and grab the `nextQuestion.id` for your next answer

Repeat until `sessionStatus` is `COMPLETED`.

---

## 6. Scoring

Points are awarded per question based on difficulty:

| Difficulty | Points |
|------------|--------|
| Easy       | 10     |
| Medium     | 20     |
| Hard       | 30     |

Wrong answers score 0. Maximum score depends on the questions you're dealt.

---

## 7. Check the Leaderboard

1. Expand **GET /api/v1/leaderboard** → click **Try it out**
2. Set `topic` (e.g. `science`) and optionally `top` (default 10)
3. Click **Execute**

Scores accumulate across multiple plays on the same topic.

---

## 8. Get Your Session State

Use **GET /api/v1/quizzes/{id}** at any point to fetch the current state of your quiz.

---

## Tips

- Each session is valid for **30 minutes** while in progress, and **5 minutes** after completion.
- You can play multiple sessions simultaneously with different topics or player names.
- Play all three topics to appear on multiple leaderboards.
- Every request gets a unique `X-Transaction-Id` response header — useful for tracing logs.

---

## Health Check

**GET /actuator/health** is also available in the Swagger UI, or directly:

```bash
curl -s http://localhost:8080/actuator/health
```