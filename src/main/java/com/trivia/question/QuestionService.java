package com.trivia.question;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trivia.exception.TopicNotFoundException;
import com.trivia.model.Question;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class QuestionService {

    private static final Logger log = LoggerFactory.getLogger(QuestionService.class);

    private final Map<String, List<Question>> questionBank;

    public QuestionService(ObjectMapper objectMapper) throws IOException {
        TypeReference<List<Question>> typeRef = new TypeReference<>() {};
        Map<String, List<Question>> bank = new HashMap<>();

        Resource[] resources = new PathMatchingResourcePatternResolver()
                .getResources("classpath:questions/*.json");

        for (Resource resource : resources) {
            String filename = resource.getFilename();
            String topic = filename.substring(0, filename.lastIndexOf('.'));
            List<Question> questions = objectMapper.readValue(resource.getInputStream(), typeRef);
            bank.put(topic, questions);
        }

        this.questionBank = Map.copyOf(bank);
        log.info("Loaded question bank: {} topics, {} total questions",
                questionBank.size(),
                questionBank.values().stream().mapToInt(List::size).sum());
    }

    public Map<String, Integer> getTopicSummary() {
        return questionBank.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size()));
    }

    public Flux<Question> fetchQuestions(String topic, int count) {
        List<Question> questions = questionBank.getOrDefault(topic.toLowerCase(), List.of());
        if (questions.isEmpty()) {
            log.warn("No questions found for topic '{}'", topic);
            return Flux.error(new TopicNotFoundException(topic));
        }
        List<Question> shuffled = new ArrayList<>(questions);
        Collections.shuffle(shuffled);
        return Flux.fromIterable(shuffled.stream().limit(count).toList());
    }
}