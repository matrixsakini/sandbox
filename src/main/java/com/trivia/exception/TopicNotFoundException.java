package com.trivia.exception;

public class TopicNotFoundException extends RuntimeException {

    private final String topic;

    public TopicNotFoundException(String topic) {
        super("No questions available for topic '" + topic + "'. Available topics: science, history, technology");
        this.topic = topic;
    }

    public String getTopic() {
        return topic;
    }
}