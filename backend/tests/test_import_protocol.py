"""Подготовка гонки и участников из JSON-протокола на PostgreSQL."""

from collections import Counter
from copy import deepcopy
from datetime import date
from pathlib import Path

import pytest
from app.models import (
    Discipline,
    Equipment,
    Participant,
    Race,
    RaceParticipant,
    RaceParticipantStatus,
    RaceStatus,
    Stage,
    StageStatus,
)
from app.services.protocol_import import prepare_protocol_import
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
