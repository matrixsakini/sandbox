package com.trivia.service;

import com.trivia.config.ChoreProperties;
import com.trivia.dto.ChoreBoardDto;
import com.trivia.repository.ChoreBoardRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

@Service
public class ChoreService {

    private final ChoreBoardRepository repository;
    private final ChoreProperties props;

    public ChoreService(ChoreBoardRepository repository, ChoreProperties props) {
        this.repository = repository;
        this.props = props;
    }

    public Mono<ChoreBoardDto> getBoard() {
        LocalDate today = LocalDate.now(ZoneId.of(props.zone()));
        String weekId = weekIdOf(today);
        return repository.findMarks(weekId).map(marks -> toBoard(weekId, today, marks));
    }

    public Mono<ChoreBoardDto> mark(String choreId, int person, boolean done) {
        if (props.list().stream().noneMatch(c -> c.id().equals(choreId))) {
            return Mono.error(new IllegalArgumentException("Unknown chore: " + choreId));
        }
        if (person < 0 || person >= props.people().size()) {
            return Mono.error(new IllegalArgumentException("Person index out of range: " + person));
        }
        String weekId = weekIdOf(LocalDate.now(ZoneId.of(props.zone())));
        return repository.setMark(weekId, choreId + ":" + person, done)
                .then(getBoard());
    }

    // ISO week id, e.g. "2026-W29" — the board key rolls over (and thus resets) every Monday.
    static String weekIdOf(LocalDate date) {
        return "%d-W%02d".formatted(
                date.get(IsoFields.WEEK_BASED_YEAR),
                date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    }

    private ChoreBoardDto toBoard(String weekId, LocalDate today, Map<String, String> marks) {
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<ChoreBoardDto.ChoreDto> chores = props.list().stream()
                .map(chore -> new ChoreBoardDto.ChoreDto(
                        chore.id(),
                        chore.label(),
                        IntStream.range(0, props.people().size())
                                .mapToObj(i -> marks.containsKey(chore.id() + ":" + i))
                                .toList()))
                .toList();
        return new ChoreBoardDto(weekId, monday.toString(), monday.plusDays(6).toString(),
                props.people(), chores);
    }
}
