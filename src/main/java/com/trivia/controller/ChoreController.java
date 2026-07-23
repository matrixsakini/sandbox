package com.trivia.controller;

import com.trivia.dto.ChoreBoardDto;
import com.trivia.dto.MarkChoreRequest;
import com.trivia.service.ChoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/chores")
public class ChoreController {

    private final ChoreService choreService;

    public ChoreController(ChoreService choreService) {
        this.choreService = choreService;
    }

    @GetMapping("/board")
    @Tag(name = "Chores")
    @Operation(summary = "Get the current week's chore board")
    public Mono<ChoreBoardDto> getBoard() {
        return choreService.getBoard();
    }

    @PutMapping("/board/marks")
    @Tag(name = "Chores")
    @Operation(summary = "Mark or unmark a chore for one person this week")
    public Mono<ChoreBoardDto> mark(@RequestBody @Validated MarkChoreRequest request) {
        return choreService.mark(request.choreId(), request.person(), request.done());
    }
}
