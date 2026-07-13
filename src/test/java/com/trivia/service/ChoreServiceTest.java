package com.trivia.service;

import com.trivia.config.ChoreProperties;
import com.trivia.repository.ChoreBoardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChoreServiceTest {

    @Mock ChoreBoardRepository repository;

    ChoreService choreService;

    ChoreProperties props = new ChoreProperties(
            List.of("Ana", "Ben"),
            List.of(new ChoreProperties.Chore("dishes", "Dishes"),
                    new ChoreProperties.Chore("trash", "Trash")),
            Duration.ofDays(35),
            "UTC");

    @BeforeEach
    void setUp() {
        choreService = new ChoreService(repository, props);
    }

    @Test
    void weekIdOf_usesIsoWeekBasedYear() {
        assertThat(ChoreService.weekIdOf(LocalDate.of(2026, 7, 13))).isEqualTo("2026-W29");
        // Jan 1st 2027 falls in the last ISO week of 2026
        assertThat(ChoreService.weekIdOf(LocalDate.of(2027, 1, 1))).isEqualTo("2026-W53");
        assertThat(ChoreService.weekIdOf(LocalDate.of(2026, 1, 5))).isEqualTo("2026-W02");
    }

    @Test
    void getBoard_mapsMarksToPeopleAndChores() {
        when(repository.findMarks(anyString()))
                .thenReturn(Mono.just(Map.of("dishes:0", "1", "trash:1", "1")));

        StepVerifier.create(choreService.getBoard())
                .assertNext(board -> {
                    assertThat(board.people()).containsExactly("Ana", "Ben");
                    assertThat(board.chores()).hasSize(2);
                    assertThat(board.chores().get(0).done()).containsExactly(true, false);
                    assertThat(board.chores().get(1).done()).containsExactly(false, true);
                    assertThat(board.weekId()).matches("\\d{4}-W\\d{2}");
                })
                .verifyComplete();
    }

    @Test
    void mark_writesFieldAndReturnsUpdatedBoard() {
        when(repository.setMark(anyString(), eq("dishes:1"), eq(true))).thenReturn(Mono.empty());
        when(repository.findMarks(anyString())).thenReturn(Mono.just(Map.of("dishes:1", "1")));

        StepVerifier.create(choreService.mark("dishes", 1, true))
                .assertNext(board -> assertThat(board.chores().get(0).done()).containsExactly(false, true))
                .verifyComplete();

        verify(repository).setMark(anyString(), eq("dishes:1"), eq(true));
    }

    @Test
    void mark_rejectsUnknownChoreAndBadPersonIndex() {
        StepVerifier.create(choreService.mark("mow-lawn", 0, true))
                .expectError(IllegalArgumentException.class)
                .verify();

        StepVerifier.create(choreService.mark("dishes", 2, true))
                .expectError(IllegalArgumentException.class)
                .verify();
    }
}
