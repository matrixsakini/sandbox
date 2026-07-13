package com.trivia;

import com.trivia.config.ChoreProperties;
import com.trivia.config.QuizProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({QuizProperties.class, ChoreProperties.class})
public class TriviaApplication {

    public static void main(String[] args) {
        SpringApplication.run(TriviaApplication.class, args);
    }
}
