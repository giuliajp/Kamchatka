"""Проверки длительностей, статусов, штрафов и разбора исходного PDF-протокола."""

from pathlib import Path

import pytest

from scripts.parse_protocol import (
    duration_to_seconds,
    parse_participants,
    parse_penalties,
    parse_protocol,
    parse_stage_results,
)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("00:00:00", 0),
        ("02:10:02", 7802),
        ("37:11:47", 133907),
        ("100:00:00", 360000),
        (" 01:02:03 ", 3723),
    ],
)
def test_duration_to_seconds(value: str, expected: int) -> None:
    """Длительности могут превышать сутки и содержать пробелы по краям."""
    assert duration_to_seconds(value) == expected


@pytest.mark.parametrize("value", ["", "DNF", "02:60:00", "02:10:60", "-01:00:00"])
def test_duration_to_seconds_rejects_invalid_values(value: str) -> None:
    """Некорректное время и статусы не преобразуются в длительность."""
    with pytest.raises(ValueError, match="Некорректная длительность"):
        duration_to_seconds(value)


@pytest.mark.parametrize(
    ("raw_result", "speed", "status", "seconds", "has_warning"),
    [
        ("02:10:02", "15,5", "finished", 7802, False),
        ("DNF", "#ЗНАЧ!", "dnf", None, False),
        ("DNS", "#ДЕЛ/0!", "dns", None, False),
        ("DSQ", "0", "dsq", None, False),
        ("00:00:00", "0.0", None, None, True),
    ],
)
def test_parse_stage_results_preserves_status_and_summary(
    raw_result, speed, status, seconds, has_warning,
) -> None:
    """Нулевой этап остаётся неизвестным, статусы и общий итог не теряются."""
    stages = [{"number": 1, "distance_km": 33.7}, {"number": 2, "distance_km": 50.0}]
    summary = "15,5 DNS 0"
    results, summary_text = parse_stage_results(
        f"01:00:00 33.7 {raw_result} {speed} {summary}", stages,
    )

    assert [result["stage_number"] for result in results] == [1, 2]
    assert results[0]["status"] == "finished"
    assert results[0]["final_time_seconds"] == 3600
    assert results[0]["warning"] is None
    assert results[1]["raw_result"] == raw_result
    assert results[1]["status"] == status
    assert results[1]["final_time_seconds"] == seconds
    assert bool(results[1]["warning"]) == has_warning
    assert summary_text == summary


@pytest.mark.parametrize(
    ("raw_results", "expected_warnings"),
    [
        (("DNF", "00:00:00", "00:00:00"), [False, False, False]),
        (("00:10:00", "DNS", "00:00:00"), [False, False, False]),
        (("00:00:00", "DNF", "00:00:00"), [True, False, False]),
        (("00:00:00", "DNS", "00:00:00"), [True, False, False]),
        (("00:10:00", "00:00:00", "00:00:00"), [False, True, True]),
        (("DSQ", "00:00:00", "00:00:00"), [False, True, True]),
    ],
)
def test_zero_time_warning_depends_on_prior_dnf_or_dns(raw_results, expected_warnings) -> None:
    """Только предшествующий DNF/DNS объясняет отсутствие следующих результатов."""
    stages = [{"number": number, "distance_km": 10.0} for number in (1, 2, 3)]
    summary = "#ЗНАЧ! DNF 0"
    stage_text = " ".join(f"{raw_result} 0" for raw_result in raw_results)

    results, summary_text = parse_stage_results(f"{stage_text} {summary}", stages)

    assert [result["raw_result"] for result in results] == list(raw_results)
    assert [bool(result["warning"]) for result in results] == expected_warnings
    assert summary_text == summary
    for result in results:
        if result["raw_result"] == "00:00:00":
            assert result["status"] is None
            assert result["final_time_seconds"] is None


@pytest.mark.parametrize(
    ("note", "seconds", "warning"),
    [
        ("штр.вр. 2 мин. п.П.14.11.14", 120, None),
        ("  ШТР. ВР. 3 СЕК. П, П.14.11.14  ", 3, None),
        ("", None, None),
        ("0", None, None),
        ("штр.вр. 0 мин. п.П.14.11.14", None, "Некорректная длительность"),
        ("штр.вр. -2 мин. п.П.14.11.14", None, "Не удалось распознать"),
        ("предупреждение судьи", None, "Не удалось распознать"),
    ],
)
def test_parse_penalties_preserves_note_and_reports_ambiguity(note, seconds, warning) -> None:
    """Минуты и секунды распознаются; этап не выдумывается, ошибки видны."""
    penalties, warnings = parse_penalties(note)

    if seconds is None:
        assert penalties == []
    else:
        assert penalties == [{
            "seconds": seconds,
            "rule_reference": "П.14.11.14",
            "stage_number": None,
            "raw_note": note,
        }]
    if warning is None:
        assert warnings == []
    else:
        assert len(warnings) == 1
        assert warning in warnings[0]


@pytest.mark.parametrize(
    ("raw_result", "place", "time_seconds", "note", "penalty_seconds"),
    [
        ("02:10:02", "1", 7802, "штр.вр. 2 мин. п.П.14.11.14", 120),
        ("02:10:02", "1", 7802, "0", 0),
        ("DNF", "", None, "штр.вр. 2 мин. п.П.14.11.14", 120),
        ("DNS", "", None, "штр.вр. 3 сек. п.П.14.11.14", 3),
        ("DSQ", "", None, "предупреждение судьи", 0),
        ("02:10:02", "1", 7802, "штр.вр. 0 мин. п.П.14.11.14", 0),
    ],
)
def test_participant_penalty_total_is_informational(
    raw_result, place, time_seconds, note, penalty_seconds,
) -> None:
    """Сумма распознанных штрафов есть при любом статусе и не меняет время."""
    pages = [
        "Дисциплина Нарта-длинная дистанция более 8 собак\n"
        "1 18 Шевчук Георгий Геннадьевич 1993 Камчатский край "
        f"{raw_result} 15,5 15,5 {raw_result} {place} {note}"
    ]
    stages = [{"number": 1, "distance_km": 33.7}]

    (participant,) = parse_participants(pages, stages)

    assert participant["summary"]["total_penalty_seconds"] == penalty_seconds
    assert participant["summary"]["raw_result"] == raw_result
    assert participant["summary"]["total_time_seconds"] == time_seconds
    assert participant["stage_results"][0]["final_time_seconds"] == time_seconds


def test_parse_original_avacha_2026_pdf() -> None:
    """Исходный PDF даёт полный состав гонки, штрафы и статусы сходов."""
    pdf_path = (
        Path(__file__).resolve().parents[2] / "docs" / "Total_result_Avacha-2026.pdf"
    )
    document = parse_protocol(pdf_path)
    participants = document["participants"]
    by_number = {
        participant["start_number"]: participant for participant in participants
    }

    assert document["race"]["name"] == "Берингия. Авача 2026"
    assert len(participants) == 21
    assert len(by_number) == 21
    assert {p["discipline_code"] for p in participants} == {
        "ski_2",
        "sled_8",
        "sled_8plus",
    }
    assert [stage["number"] for stage in document["stages"]] == [1, 2, 3, 4, 5, 6]
    assert sum(len(p["stage_results"]) for p in participants) == 126
    assert sum(len(p["penalties"]) for p in participants) == 3
    assert {
        p["start_number"]: sum(penalty["seconds"] for penalty in p["penalties"])
        for p in participants
        if p["penalties"]
    } == {18: 120, 19: 3, 12: 360}
    assert {
        p["start_number"]: p["summary"]["status"]
        for p in participants
        if p["summary"]["status"] != "finished"
    } == {1: "dnf", 10: "dns"}
    assert by_number[1]["summary"]["total_time_seconds"] is None
    assert by_number[10]["summary"]["total_time_seconds"] is None
    assert [r["status"] for r in by_number[1]["stage_results"]] == [
        "dnf", None, None, None, None, None,
    ]
    assert [r["status"] for r in by_number[10]["stage_results"]] == [
        "finished", "finished", "dns", None, None, None,
    ]
    assert by_number[18]["stage_results"][0]["final_time_seconds"] == 7802
    assert by_number[18]["summary"]["total_time_seconds"] == 66310
    assert {
        p["start_number"]: p["summary"]["total_penalty_seconds"]
        for p in participants
        if p["penalties"]
    } == {18: 120, 19: 3, 12: 360}
    assert document["warnings"] == []
    for participant in participants:
        assert all(result["warning"] is None for result in participant["stage_results"])
        assert participant["penalty_warnings"] == []
        assert participant["summary"]["total_penalty_seconds"] == sum(
            penalty["seconds"] for penalty in participant["penalties"]
        )
        if participant["summary"]["status"] == "finished":
            assert participant["summary"]["total_time_seconds"] == sum(
                result["final_time_seconds"] for result in participant["stage_results"]
            )
