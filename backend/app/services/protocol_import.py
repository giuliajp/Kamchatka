"""Подготовка записей гонки и участников для импорта JSON-протокола.

Транзакцией управляет вызывающий код. Функция выполняет flush, но не commit;
при ошибке вызывающий код должен откатить всю транзакцию.
Протоколы, результаты и штрафы добавляются на следующем шаге задачи 2.2.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import Base
from app.models import (
    Discipline,
    Equipment,
    Participant,
    Race,
    RaceParticipant,
    RaceParticipantStatus,
    RaceStatus,
    Stage,
    StageResultStatus,
    StageStatus,
)
from app.schemas.protocol_import import ParticipantImportData, ProtocolImportData

ModelT = TypeVar("ModelT", bound=Base)
ParticipantIdentity = tuple[str, str, str, int]

DISCIPLINES = {
    "ski_2": {
        "name": "Лыжи — длинная дистанция, 2 собаки",
        "equipment": Equipment.SKI,
        "dogs_min": 2,
        "dogs_max": 2,
        "sort_order": 1,
    },
    "sled_8": {
        "name": "Нарта — длинная дистанция, 8 собак",
        "equipment": Equipment.SLED,
        "dogs_min": 8,
        "dogs_max": 8,
        "sort_order": 2,
    },
    "sled_8plus": {
        "name": "Нарта — длинная дистанция, более 8 собак",
        "equipment": Equipment.SLED,
        "dogs_min": 9,
        "dogs_max": None,
        "sort_order": 3,
    },
}


@dataclass
class PreparedProtocolImport:
    race: Race
    stages: dict[int, Stage]
    disciplines: dict[str, Discipline]
    entries: dict[int, RaceParticipant]
    created: Counter[str]


def _check_fields(record: Base, values: dict, context: str) -> None:
    for field, expected in values.items():
        actual = getattr(record, field)
        if actual != expected:
            raise ValueError(
                f"{context}: конфликт поля {field}: "
                f"в БД {actual!r}, в JSON {expected!r}"
            )


async def _get_or_create(
    session: AsyncSession,
    model: type[ModelT],
    key: dict,
    values: dict,
    created: Counter[str],
    context: str,
    create_only: dict | None = None,
) -> ModelT:
    record = (await session.scalars(select(model).filter_by(**key))).one_or_none()
    if record is not None:
        _check_fields(record, values, context)
        return record
    record = model(**key, **values, **(create_only or {}))
    session.add(record)
    await session.flush()
    created[model.__tablename__] += 1
    return record


def _identity(
    last_name: str,
    first_name: str,
    middle_name: str | None,
    birth_year: int,
) -> ParticipantIdentity:
    parts = [
        " ".join((part or "").split()).casefold()
        for part in (last_name, first_name, middle_name)
    ]
    return parts[0], parts[1], parts[2], birth_year


def _participation_status(participant: ParticipantImportData) -> RaceParticipantStatus:
    status = participant.summary.status
    if status == StageResultStatus.DNS:
        started = any(
            result.status in (StageResultStatus.FINISHED, StageResultStatus.DNF)
            for result in participant.stage_results
        )
        return (
            RaceParticipantStatus.DNF if started else RaceParticipantStatus.REGISTERED
        )
    return RaceParticipantStatus(status.value)


async def _find_people(
    session: AsyncSession,
    data: ProtocolImportData,
) -> dict[ParticipantIdentity, Participant]:
    years = {participant.birth_year for participant in data.participants}
    candidates = await session.scalars(
        select(Participant).where(Participant.birth_year.in_(years))
    )
    by_identity = defaultdict(list)
    for person in candidates:
        key = _identity(
            person.last_name, person.first_name, person.middle_name, person.birth_year
        )
        by_identity[key].append(person)
    people = {}
    for participant in data.participants:
        key = _identity(*participant.name_parts, participant.birth_year)
        matches = by_identity[key]
        if len(matches) > 1:
            raise ValueError(
                f"Участник №{participant.start_number}: неоднозначное совпадение "
                f"по ФИО и году рождения: {participant.full_name}, "
                f"{participant.birth_year}"
            )
        if matches:
            people[key] = matches[0]
    return people


async def prepare_protocol_import(
    session: AsyncSession,
    document: dict,
) -> PreparedProtocolImport:
    """Создаёт или находит гонку, этапы, дисциплины, спортсменов и участия.

    Вызывать внутри транзакции, например async with session.begin().
    Возвращает объекты с id для последующего переноса протоколов и результатов.
    Проверка на этом этапе охватывает поля основных сущностей и статусы;
    полная проверка результатов и штрафов относится к следующему шагу импорта.
    """
    data = ProtocolImportData.model_validate(document)
    people = await _find_people(session, data)
    created = Counter()
    race = await _get_or_create(
        session,
        Race,
        {"year": data.race.year},
        {
            "name": data.race.name,
            "start_date": data.race.start_date,
            "end_date": data.race.end_date,
            "location": data.race.location,
            "status": RaceStatus.FINISHED,
        },
        created,
        f"Гонка {data.race.year}",
    )
    stages = {}
    for source in sorted(data.stages, key=lambda item: item.number):
        stages[source.number] = await _get_or_create(
            session,
            Stage,
            {"race_id": race.id, "number": source.number},
            {"distance_km": source.distance_km, "status": StageStatus.FINISHED},
            created,
            f"Этап {source.number}",
        )
    disciplines = {}
    for code in sorted(
        {participant.discipline_code for participant in data.participants}
    ):
        fields = DISCIPLINES[code]
        disciplines[code] = await _get_or_create(
            session,
            Discipline,
            {"code": code},
            {field: fields[field] for field in ("equipment", "dogs_min", "dogs_max")},
            created,
            f"Дисциплина {code}",
            create_only={"name": fields["name"], "sort_order": fields["sort_order"]},
        )
    for source in data.participants:
        key = _identity(*source.name_parts, source.birth_year)
        if key not in people:
            last_name, first_name, middle_name = source.name_parts
            people[key] = Participant(
                last_name=last_name,
                first_name=first_name,
                middle_name=middle_name,
                birth_year=source.birth_year,
            )
            session.add(people[key])
            created["participants"] += 1
    await session.flush()

    existing_entries = (
        await session.scalars(
            select(RaceParticipant).where(RaceParticipant.race_id == race.id)
        )
    ).all()
    by_number = {entry.start_number: entry for entry in existing_entries}
    by_person = {entry.participant_id: entry for entry in existing_entries}
    entries = {}
    for source in data.participants:
        number = source.start_number
        person = people[_identity(*source.name_parts, source.birth_year)]
        other_entry = by_person.get(person.id)
        if other_entry is not None and other_entry.start_number != number:
            raise ValueError(
                f"Участник №{number}: спортсмен уже участвует в этой гонке "
                f"под номером {other_entry.start_number}"
            )
        fields = {
            "participant_id": person.id,
            "discipline_id": disciplines[source.discipline_code].id,
            "region": source.region,
            "status": _participation_status(source),
        }
        entry = by_number.get(number)
        if entry is None:
            entry = RaceParticipant(race_id=race.id, start_number=number, **fields)
            session.add(entry)
            created["race_participants"] += 1
        else:
            _check_fields(entry, fields, f"Участник №{number}")
        entries[number] = entry
    await session.flush()
    return PreparedProtocolImport(race, stages, disciplines, entries, created)
