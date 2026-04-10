package com.trivia.e2e.steps;

import com.trivia.dto.AnswerResultDto;
import com.trivia.dto.QuizSessionDto;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class QuizStepDefinitions {

    @Autowired
    private WebTestClient webTestClient;

    // per-scenario state
    private String sessionId;
    private String currentQuestionId;
    private int lastStatus;
    private QuizSessionDto lastSession;
    private AnswerResultDto lastAnswerResult;

    // -------------------------------------------------------------------------
    // Starting a quiz
    // -------------------------------------------------------------------------

    @When("{string} starts a quiz on topic {string}")
    public void startsQuiz(String player, String topic) {
        lastSession = webTestClient.post().uri("/api/v1/quizzes")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("playerName", player, "topic", topic))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(QuizSessionDto.class)
                .returnResult().getResponseBody();

        sessionId = lastSession.sessionId();
        currentQuestionId = lastSession.currentQuestion() != null
                ? lastSession.currentQuestion().id() : null;
    }

    @Given("{string} has started a quiz on topic {string}")
    public void hasStartedQuiz(String player, String topic) {
        startsQuiz(player, topic);
    }

    @When("a quiz is started on unknown topic {string}")
    public void startsQuizUnknownTopic(String topic) {
        lastStatus = webTestClient.post().uri("/api/v1/quizzes")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("playerName", "anon", "topic", topic))
                .exchange()
                .returnResult(String.class)
                .getStatus().value();
    }

    // -------------------------------------------------------------------------
    // Answering questions
    // -------------------------------------------------------------------------

    @When("all questions are answered correctly")
    public void answerAllCorrectly() {
        answerAll(0); // correctIndex is always 0 in the e2e question bank
    }

    @When("all questions are answered incorrectly")
    public void answerAllIncorrectly() {
        answerAll(1); // any index other than 0 is wrong
    }

    private void answerAll(int chosenIndex) {
        while (currentQuestionId != null) {
            lastAnswerResult = submitAnswer(currentQuestionId, chosenIndex);
            currentQuestionId = lastAnswerResult.nextQuestion() != null
                    ? lastAnswerResult.nextQuestion().id() : null;
        }
    }

    @When("the current question is answered twice")
    public void answerCurrentQuestionTwice() {
        submitAnswer(currentQuestionId, 0);
        // second submission of the same question
        lastStatus = webTestClient.post().uri("/api/v1/quizzes/{id}/answers", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("questionId", currentQuestionId, "chosenIndex", 0))
                .exchange()
                .returnResult(String.class)
                .getStatus().value();
    }

    private AnswerResultDto submitAnswer(String questionId, int chosenIndex) {
        return webTestClient.post().uri("/api/v1/quizzes/{id}/answers", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("questionId", questionId, "chosenIndex", chosenIndex))
                .exchange()
                .expectStatus().isOk()
                .expectBody(AnswerResultDto.class)
                .returnResult().getResponseBody();
    }

    // -------------------------------------------------------------------------
    // Session retrieval
    // -------------------------------------------------------------------------

    @When("session {string} is fetched")
    public void fetchSession(String id) {
        lastStatus = webTestClient.get().uri("/api/v1/quizzes/{id}", id)
                .exchange()
                .returnResult(String.class)
                .getStatus().value();
    }

    @Then("fetching the session returns status {string}")
    public void fetchingSessionReturnsStatus(String expectedStatus) {
        lastSession = webTestClient.get().uri("/api/v1/quizzes/{id}", sessionId)
                .exchange()
                .expectStatus().isOk()
                .expectBody(QuizSessionDto.class)
                .returnResult().getResponseBody();

        assertThat(lastSession.status()).isEqualTo(expectedStatus);
    }

    // -------------------------------------------------------------------------
    // Assertions
    // -------------------------------------------------------------------------

    @Then("the quiz is {string} with {int} questions remaining")
    public void quizStatusAndRemaining(String expectedStatus, int expectedRemaining) {
        assertThat(lastSession.status()).isEqualTo(expectedStatus);
        assertThat(lastSession.questionsRemaining()).isEqualTo(expectedRemaining);
    }

    @Then("the quiz is {string} with a score of {int}")
    public void quizStatusAndScore(String expectedStatus, int expectedScore) {
        assertThat(lastAnswerResult.sessionStatus()).isEqualTo(expectedStatus);
        assertThat(lastAnswerResult.totalScore()).isEqualTo(expectedScore);
    }

    @And("{string} appears in the leaderboard for topic {string}")
    public void appearsInLeaderboard(String player, String topic) {
        var entries = webTestClient.get()
                .uri(u -> u.path("/api/v1/leaderboard").queryParam("topic", topic).queryParam("top", 10).build())
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(Map.class)
                .returnResult().getResponseBody();

        assertThat(entries).anySatisfy(entry ->
                assertThat(entry.get("playerName")).isEqualTo(player));
    }

    @And("the current question has {int} options")
    public void currentQuestionHasOptions(int count) {
        assertThat(lastSession.currentQuestion()).isNotNull();
        assertThat(lastSession.currentQuestion().options()).hasSize(count);
    }

    @Then("the response status is {int}")
    public void responseStatusIs(int expected) {
        assertThat(lastStatus).isEqualTo(expected);
    }
}