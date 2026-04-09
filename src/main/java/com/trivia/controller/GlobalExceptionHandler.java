package com.trivia.controller;

import com.trivia.exception.SessionNotFoundException;
import com.trivia.exception.TopicNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import reactor.core.publisher.Mono;

import java.net.URI;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(SessionNotFoundException.class)
    public Mono<ProblemDetail> handleSessionNotFound(SessionNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setType(URI.create("https://trivia.example.com/errors/session-not-found"));
        problem.setTitle("Session Not Found");
        return Mono.just(problem);
    }

    @ExceptionHandler(TopicNotFoundException.class)
    public Mono<ProblemDetail> handleTopicNotFound(TopicNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setType(URI.create("https://trivia.example.com/errors/topic-not-found"));
        problem.setTitle("Topic Not Found");
        return Mono.just(problem);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public Mono<ProblemDetail> handleIllegalArgument(IllegalArgumentException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setType(URI.create("https://trivia.example.com/errors/bad-request"));
        problem.setTitle("Bad Request");
        return Mono.just(problem);
    }
}