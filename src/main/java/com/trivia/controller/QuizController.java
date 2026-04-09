package com.trivia.controller;

import com.trivia.dto.AnswerResultDto;
import com.trivia.dto.QuizSessionDto;
import com.trivia.dto.StartQuizRequest;
import com.trivia.dto.SubmitAnswerRequest;
import com.trivia.model.LeaderboardEntry;
import com.trivia.question.QuestionService;
import com.trivia.service.QuizService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class QuizController {

    private final QuizService quizService;
    private final QuestionService questionService;

    public QuizController(QuizService quizService, QuestionService questionService) {
        this.quizService = quizService;
        this.questionService = questionService;
    }

    @GetMapping("/topics")
    @Tag(name = "Topics")
    @Operation(summary = "List available topics and their question counts")
    public Mono<List<Map<String, Object>>> getTopics() {
        return Mono.just(
                questionService.getTopicSummary().entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(e -> Map.<String, Object>of("topic", e.getKey(), "questionCount", e.getValue()))
                        .toList()
        );
    }

    @PostMapping("/quizzes")
    @ResponseStatus(HttpStatus.CREATED)
    @Tag(name = "Quiz")
    @Operation(summary = "Start a new quiz")
    public Mono<QuizSessionDto> startQuiz(@RequestBody @Validated StartQuizRequest request) {
        return quizService.startQuiz(request.topic(), request.playerName())
                .map(QuizSessionDto::from);
    }

    @GetMapping("/quizzes/{id}")
    @Tag(name = "Quiz")
    @Operation(summary = "Get quiz session state")
    public Mono<QuizSessionDto> getSession(
            @Parameter(description = "Session ID") @PathVariable("id") String sessionId) {
        return quizService.getSession(sessionId)
                .map(QuizSessionDto::from);
    }

    @PostMapping("/quizzes/{id}/answers")
    @Tag(name = "Quiz")
    @Operation(summary = "Submit an answer")
    public Mono<AnswerResultDto> submitAnswer(
            @Parameter(description = "Session ID") @PathVariable("id") String sessionId,
            @RequestBody @Validated SubmitAnswerRequest request) {
        return quizService.submitAnswer(sessionId, request.questionId(), request.chosenIndex())
                .map(session -> AnswerResultDto.from(session, session.answers().getLast()));
    }

    @GetMapping("/leaderboard")
    @Tag(name = "Leaderboard")
    @Operation(summary = "Get leaderboard for a topic")
    public Flux<LeaderboardEntry> getLeaderboard(
            @Parameter(description = "Topic: science, history, or technology") @RequestParam String topic,
            @Parameter(description = "Number of entries to return (default 10)") @RequestParam(defaultValue = "10") int top) {
        return quizService.getLeaderboard(topic, top);
    }
}