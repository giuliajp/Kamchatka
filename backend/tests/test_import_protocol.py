"""Подготовка основных записей и перенос полного JSON-протокола на PostgreSQL."""

from collections import Counter
from copy import deepcopy
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from app.models import (
    Discipline,
    Equipment,
    Participant,
    Penalty,
    Protocol,
    ProtocolStatus,
    Race,
    RaceParticipant,
    RaceParticipantStatus,
    RaceStatus,
    Stage,
    StageResult,
    StageResultStatus,
    StageStatus,
)
from app.services.protocol_import import import_protocol, prepare_protocol_import
from scripts.parse_protocol import parse_protocol
from sqlalchemy import func, select


@pytest.fixture(scope="module")
def archive_document():
    pdf = Path(__file__).resolve().parents[2] / "docs" / "Total_result_Avacha-2026.pdf"
    return parse_protocol(pdf)


@pytest.fixture
def document(archive_document):
    return deepcopy(archive_document)


async def count(session, model):
    return await session.scalar(select(func.count()).select_from(model))


async def test_prepare_original_archive(session, document):
    original = deepcopy(document)
    async with session.begin():
        prepared = await prepare_protocol_import(session, document)

    assert prepared.race.name == "Берингия. Авача 2026"
    assert prepared.race.start_date == date(2026, 2, 6)
    assert prepared.race.end_date == date(2026, 2, 15)
    assert prepared.race.status == RaceStatus.FINISHED
    assert prepared.race.is_current is False
    assert len(prepared.stages) == 6
    assert all(
        stage.status == StageStatus.FINISHED for stage in prepared.stages.values()
    )
    assert set(prepared.disciplines) == {"ski_2", "sled_8", "sled_8plus"}
    assert len(prepared.entries) == 21
    assert Counter(entry.status for entry in prepared.entries.values()) == {
        RaceParticipantStatus.FINISHED: 19,
        RaceParticipantStatus.DNF: 2,
    }
    assert prepared.entries[10].status == RaceParticipantStatus.DNF
    assert prepared.created == {
        "races": 1,
        "stages": 6,
        "disciplines": 3,
        "participants": 21,
        "race_participants": 21,
    }
    assert await count(session, Participant) == 21
    assert document == original


async def test_prepare_archive_again_reuses_records(session, document):
    async with session.begin():
        first = await prepare_protocol_import(session, document)
    race_id = first.race.id
    entry_ids = {number: entry.id for number, entry in first.entries.items()}
    session.expunge_all()

    document["participants"].reverse()
    document["stages"].reverse()
    async with session.begin():
        second = await prepare_protocol_import(session, document)

    assert second.race.id == race_id
    assert {number: entry.id for number, entry in second.entries.items()} == entry_ids
    assert second.created == {}
    for model, expected in [
        (Race, 1),
        (Stage, 6),
        (Discipline, 3),
        (Participant, 21),
        (RaceParticipant, 21),
    ]:
        assert await count(session, model) == expected


async def test_reuses_person_and_preserves_existing_fields(session, document):
    person = Participant(
        last_name="  шЕвЧуК  ",
        first_name="георгий",
        middle_name=" геннадьевич ",
        birth_year=1993,
        photo_url="https://example.com/photo.jpg",
        bio="Биография",
    )
    discipline = Discipline(
        code="sled_8plus",
        name="Название из админки",
        equipment=Equipment.SLED,
        dogs_min=9,
        sort_order=10,
        is_active=False,
    )
    current_race = Race(name="Авача 2027", year=2027, is_current=True)
    session.add_all([person, discipline, current_race])
    await session.commit()

    async with session.begin():
        prepared = await prepare_protocol_import(session, document)

    assert prepared.entries[18].participant_id == person.id
    assert prepared.created["participants"] == 20
    assert prepared.created["disciplines"] == 2
    assert person.last_name == "  шЕвЧуК  "
    assert person.photo_url == "https://example.com/photo.jpg"
    assert person.bio == "Биография"
    assert discipline.name == "Название из админки"
    assert discipline.sort_order == 10
    assert discipline.is_active is False
    assert current_race.is_current is True


async def test_ambiguous_person_is_not_chosen_automatically(session, document):
    session.add_all(
        [
            Participant(
                last_name="Шевчук",
                first_name="Георгий",
                middle_name="Геннадьевич",
                birth_year=1993,
            ),
            Participant(
                last_name="шевчук",
                first_name="георгий",
                middle_name="геннадьевич",
                birth_year=1993,
            ),
        ]
    )
    await session.commit()

    with pytest.raises(ValueError, match="Участник №18: неоднозначное совпадение"):
        async with session.begin():
            await prepare_protocol_import(session, document)

    assert await count(session, Race) == 0
    assert await count(session, Participant) == 2


@pytest.mark.parametrize("conflict", ["race", "stage", "region", "number"])
async def test_conflicting_archive_is_rejected(session, document, conflict):
    async with session.begin():
        await prepare_protocol_import(session, document)
    if conflict == "race":
        document["race"]["name"] = "Другая гонка"
        message = "Гонка 2026: конфликт поля name"
    elif conflict == "stage":
        document["stages"][0]["distance_km"] = 99.0
        message = "Этап 1: конфликт поля distance_km"
    elif conflict == "region":
        document["participants"][0]["region"] = "Другой регион"
        message = "конфликт поля region"
    else:
        document["participants"][0]["start_number"] = 99
        message = "спортсмен уже участвует в этой гонке под номером"

    with pytest.raises(ValueError, match=message):
        async with session.begin():
            await prepare_protocol_import(session, document)

    assert await count(session, Race) == 1
    assert await count(session, Participant) == 21
    assert await count(session, RaceParticipant) == 21


@pytest.mark.parametrize(
    ("invalid", "message"),
    [
        ("dates", "Дата окончания гонки раньше даты начала"),
        ("stage", "Повторяются номера этапов"),
        ("number", "Повторяется стартовый номер"),
        ("person", "повторяются ФИО и год рождения"),
        ("discipline", "discipline_code"),
        ("name", "Ожидается Фамилия Имя"),
        ("results", "результаты не соответствуют этапам гонки"),
    ],
)
async def test_invalid_base_data_is_rejected_before_writing(
    session, document, invalid, message
):
    if invalid == "dates":
        document["race"]["end_date"] = "2026-02-01"
    elif invalid == "stage":
        document["stages"].append(deepcopy(document["stages"][0]))
    elif invalid == "number":
        document["participants"][1]["start_number"] = document["participants"][0][
            "start_number"
        ]
    elif invalid == "person":
        for field in ("full_name", "birth_year"):
            document["participants"][1][field] = document["participants"][0][field]
    elif invalid == "discipline":
        document["participants"][0]["discipline_code"] = "unknown"
    elif invalid == "name":
        document["participants"][0]["full_name"] = (
            "Слишком много отдельных частей имени"
        )
    else:
        document["participants"][0]["stage_results"].pop()

    with pytest.raises(ValueError, match=message):
        async with session.begin():
            await prepare_protocol_import(session, document)

    for model in (Race, Stage, Discipline, Participant, RaceParticipant):
        assert await count(session, model) == 0


async def test_reuses_person_without_patronymic(session, document):
    source = document["participants"][0]
    source["full_name"] = "Филимонова Алиса"
    person = Participant(
        last_name="Филимонова", first_name="Алиса", birth_year=source["birth_year"]
    )
    session.add(person)
    await session.commit()

    async with session.begin():
        prepared = await prepare_protocol_import(session, document)

    assert prepared.entries[source["start_number"]].participant_id == person.id
    assert prepared.created["participants"] == 20


@pytest.mark.parametrize(
    ("status", "expected"),
    [("dns", RaceParticipantStatus.REGISTERED), ("dsq", RaceParticipantStatus.DSQ)],
)
async def test_participation_status_for_non_finisher(
    session, document, status, expected
):
    participant = next(p for p in document["participants"] if p["start_number"] == 10)
    document["participants"] = [participant]
    participant["summary"]["status"] = status
    for result in participant["stage_results"]:
        result.update(
            status=status,
            raw_result=status.upper(),
            final_time_seconds=None,
            warning=None,
        )

    async with session.begin():
        prepared = await prepare_protocol_import(session, document)

    assert prepared.entries[10].status == expected


async def load_stage_results(session):
    rows = await session.execute(
        select(StageResult, Stage.number, RaceParticipant.start_number)
        .select_from(StageResult)
        .join(Protocol, StageResult.protocol_id == Protocol.id)
        .join(Stage, Protocol.stage_id == Stage.id)
        .join(RaceParticipant, StageResult.race_participant_id == RaceParticipant.id)
    )
    return {(number, start_number): result for result, number, start_number in rows}


async def test_import_original_archive_with_results_and_penalties(session, document):
    original = deepcopy(document)
    async with session.begin():
        imported = await import_protocol(session, document)

    assert imported.created == {
        "races": 1,
        "stages": 6,
        "disciplines": 3,
        "participants": 21,
        "race_participants": 21,
        "protocols": 18,
        "stage_results": 118,
        "penalties": 3,
    }
    assert imported.skipped_stage_results == 8
    assert imported.warnings == []
    for model, expected in [
        (Race, 1),
        (Stage, 6),
        (RaceParticipant, 21),
        (Protocol, 18),
        (StageResult, 118),
        (Penalty, 3),
    ]:
        assert await count(session, model) == expected
    protocols = (await session.scalars(select(Protocol))).all()
    for protocol in protocols:
        assert protocol.status == ProtocolStatus.PRELIMINARY
        assert protocol.published_at is None
        assert protocol.finalized_at is None
        assert protocol.source_filename == document["source_filename"]
        assert protocol.weather == document["protocol_metadata"]["weather"]
        assert protocol.chief_judge == document["protocol_metadata"]["chief_judge"]
        assert (
            protocol.chief_secretary == document["protocol_metadata"]["chief_secretary"]
        )

    results = await load_stage_results(session)
    assert Counter(result.status for result in results.values()) == {
        StageResultStatus.FINISHED: 116,
        StageResultStatus.DNF: 1,
        StageResultStatus.DNS: 1,
    }
    assert results[1, 1].status == StageResultStatus.DNF
    assert (
        results[1, 1].place is None
    )  # Итоговое место 5 не является местом на первом этапе.
    assert not any((number, 1) in results for number in range(2, 7))
    assert results[3, 10].status == StageResultStatus.DNS
    assert not any((number, 10) in results for number in range(4, 7))
    assert results[1, 18].final_time_seconds == 7802
    assert results[6, 18].place == 1
    assert all(results[number, 18].place is None for number in range(1, 6))
    assert all(result.net_time_seconds is None for result in results.values())
    for participant in document["participants"]:
        if participant["summary"]["status"] == "finished":
            number = participant["start_number"]
            assert (
                sum(results[stage, number].final_time_seconds for stage in range(1, 7))
                == (participant["summary"]["total_time_seconds"])
            )
    penalties = await session.execute(
        select(
            RaceParticipant.start_number,
            Penalty.seconds,
            Penalty.reason,
            Penalty.rule_reference,
        )
        .select_from(Penalty)
        .join(RaceParticipant, Penalty.race_participant_id == RaceParticipant.id)
    )
    source_by_number = {p["start_number"]: p for p in document["participants"]}
    saved_penalties = {}
    for number, seconds, reason, rule in penalties:
        source = source_by_number[number]["penalties"][0]
        saved_penalties[number] = seconds
        assert reason == source["raw_note"]
        assert rule == source["rule_reference"]
    assert saved_penalties == {18: 120, 19: 3, 12: 360}
    assert document == original


async def test_import_again_preserves_records_and_protocol_publication(
    session, document
):
    published_at = datetime(2026, 2, 16, 12, tzinfo=UTC)
    async with session.begin():
        first = await import_protocol(session, document)
        protocol = await session.scalar(select(Protocol).order_by(Protocol.id))
        protocol.status = ProtocolStatus.FINAL
        protocol.published_at = published_at
        protocol.finalized_at = published_at
        protocol.finalized_by = "Главный судья"
    protocol_id = protocol.id
    session.expunge_all()
    document["participants"].reverse()
    document["stages"].reverse()
    for participant in document["participants"]:
        participant["stage_results"].reverse()

    async with session.begin():
        second = await import_protocol(session, document)

    assert second.race_id == first.race_id
    assert second.created == {}
    assert second.skipped_stage_results == 8
    assert await count(session, StageResult) == 118
    assert await count(session, Penalty) == 3
    loaded = await session.get(Protocol, protocol_id)
    assert loaded.status == ProtocolStatus.FINAL
    assert loaded.published_at == published_at
    assert loaded.finalized_at == published_at
    assert loaded.finalized_by == "Главный судья"


@pytest.mark.parametrize(
    ("invalid", "message"),
    [
        ("unexplained_zero", "пустой результат без предшествующего DNF/DNS"),
        ("stage_warning", "этап 2: результат требует проверки"),
        ("stage_time", "Статус и время не соответствуют"),
        ("dnf_time", "Статус и время не соответствуют"),
        ("total", "общий результат не равен сумме этапов"),
        ("penalty_total", "общая сумма штрафов не совпадает"),
        ("penalty_stage", "stage_number"),
        ("penalty_warning", "примечание о штрафе требует проверки"),
        ("penalty_note", "примечание штрафа не совпадает"),
        ("place", "Не указано место финишировавшего"),
        ("warning", "Предупреждение требует проверки перед импортом"),
        ("filename", "Ожидается имя исходного PDF без пути"),
    ],
)
async def test_invalid_results_are_rejected_before_writing(
    session, document, invalid, message
):
    participant = next(p for p in document["participants"] if p["start_number"] == 18)
    withdrawn = next(p for p in document["participants"] if p["start_number"] == 1)
    if invalid == "unexplained_zero":
        participant["stage_results"][0].update(
            raw_result="00:00:00",
            status=None,
            final_time_seconds=None,
            warning=None,
        )
    elif invalid == "stage_warning":
        withdrawn["stage_results"][1]["warning"] = "Нулевое значение"
    elif invalid == "stage_time":
        participant["stage_results"][0]["final_time_seconds"] += 1
    elif invalid == "dnf_time":
        withdrawn["stage_results"][0]["final_time_seconds"] = 10
    elif invalid == "total":
        participant["summary"].update(raw_result="18:25:11", total_time_seconds=66311)
    elif invalid == "penalty_total":
        participant["summary"]["total_penalty_seconds"] += 1
    elif invalid == "penalty_stage":
        participant["penalties"][0]["stage_number"] = 1
    elif invalid == "penalty_warning":
        participant["penalty_warnings"] = ["Не удалось распознать примечание"]
    elif invalid == "penalty_note":
        participant["penalties"][0]["raw_note"] = "Другое примечание"
    elif invalid == "place":
        participant["summary"]["source_place"] = None
    elif invalid == "warning":
        document["warnings"] = ["Непонятное значение в протоколе"]
    else:
        document["source_filename"] = "folder/protocol.pdf"

    with pytest.raises(ValueError, match=message):
        async with session.begin():
            await import_protocol(session, document)

    for model in (
        Race,
        Stage,
        Participant,
        RaceParticipant,
        Protocol,
        StageResult,
        Penalty,
    ):
        assert await count(session, model) == 0


async def test_missing_metadata_is_reported_and_does_not_prevent_import(
    session, document
):
    document["protocol_metadata"] = {
        "weather": None,
        "chief_judge": None,
        "chief_secretary": None,
    }
    document["warnings"] = [
        f"В протоколе не найдено поле: {label}"
        for label in ("Погодные условия", "Главный судья", "Главный секретарь")
    ]
    async with session.begin():
        imported = await import_protocol(session, document)

    assert imported.warnings == document["warnings"]
    assert imported.created["stage_results"] == 118
    for protocol in await session.scalars(select(Protocol)):
        assert protocol.weather is None
        assert protocol.chief_judge is None
        assert protocol.chief_secretary is None


async def test_identical_penalties_keep_their_quantity_on_reimport(session, document):
    participant = next(p for p in document["participants"] if p["start_number"] == 18)
    participant["penalties"].append(deepcopy(participant["penalties"][0]))
    participant["summary"]["total_penalty_seconds"] = 240
    async with session.begin():
        first = await import_protocol(session, document)
    async with session.begin():
        second = await import_protocol(session, document)

    assert first.created["penalties"] == 4
    assert second.created["penalties"] == 0
    assert await count(session, Penalty) == 4


@pytest.mark.parametrize(
    "conflict", ["metadata", "result", "penalty", "skipped_result"]
)
async def test_conflicting_protocol_data_is_not_overwritten(
    session, document, conflict
):
    async with session.begin():
        await import_protocol(session, document)
        if conflict == "skipped_result":
            protocol_id = await session.scalar(
                select(Protocol.id)
                .join(Stage)
                .where(Stage.number == 2)
                .join(Discipline, Protocol.discipline_id == Discipline.id)
                .where(Discipline.code == "ski_2")
            )
            entry_id = await session.scalar(
                select(RaceParticipant.id).where(RaceParticipant.start_number == 1)
            )
            session.add(
                StageResult(
                    protocol_id=protocol_id,
                    race_participant_id=entry_id,
                    status=StageResultStatus.DNS,
                )
            )
    participant = next(p for p in document["participants"] if p["start_number"] == 18)
    if conflict == "metadata":
        document["protocol_metadata"]["chief_judge"] = "Другой судья"
        message = "конфликт поля chief_judge"
    elif conflict == "result":
        participant["stage_results"][0].update(
            raw_result="02:10:03", final_time_seconds=7803
        )
        participant["summary"].update(raw_result="18:25:11", total_time_seconds=66311)
        message = "конфликт поля final_time_seconds"
    elif conflict == "penalty":
        note = "штр.вр. 3 мин. п.П.14.11.14"
        participant["penalties"][0].update(seconds=180, raw_note=note)
        participant["summary"].update(total_penalty_seconds=180, raw_note=note)
        message = "штрафы в БД не совпадают с JSON"
    else:
        message = "в БД есть результат, отсутствующий в источнике"

    with pytest.raises(ValueError, match=message):
        async with session.begin():
            await import_protocol(session, document)

    assert await count(session, Protocol) == 18
    assert await count(session, StageResult) == (
        119 if conflict == "skipped_result" else 118
    )
    assert await count(session, Penalty) == 3
    results = await load_stage_results(session)
    assert results[1, 18].final_time_seconds == 7802
