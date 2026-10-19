"""Перенос JSON-протокола в существующие модели БД.

Транзакцией управляет вызывающий код. Функция выполняет flush, но не commit;
при ошибке вызывающий код должен откатить всю транзакцию.
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
    Penalty,
    Protocol,
    Race,
    RaceParticipant,
    RaceParticipantStatus,
    RaceStatus,
    Stage,
    StageResult,
    StageResultStatus,
    StageStatus,
)
from app.schemas.protocol_import import (
    CompleteProtocolImportData,
    ParticipantImportData,
    ProtocolImportData,
)

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


@dataclass
class ProtocolImportResult:
    race_id: int
    created: Counter[str]
    skipped_stage_results: int
    warnings: list[str]


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
    для полного документа использовать import_protocol.
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


async def _import_stage_results(
    session: AsyncSession,
    data: CompleteProtocolImportData,
    prepared: PreparedProtocolImport,
    protocols: dict[tuple[int, str], Protocol],
) -> int:
    existing = (
        await session.scalars(
            select(StageResult).where(
                StageResult.protocol_id.in_(
                    [protocol.id for protocol in protocols.values()]
                )
            )
        )
    ).all()
    by_key = {
        (result.protocol_id, result.race_participant_id): result for result in existing
    }
    last_stage = max(prepared.stages)
    skipped = 0
    for participant in data.participants:
        entry = prepared.entries[participant.start_number]
        for source in sorted(
            participant.stage_results, key=lambda item: item.stage_number
        ):
            protocol = protocols[source.stage_number, participant.discipline_code]
            context = (
                f"Участник №{participant.start_number}, этап {source.stage_number}"
            )
            result = by_key.get((protocol.id, entry.id))
            if source.status is None:
                if result is not None:
                    raise ValueError(
                        f"{context}: в БД есть результат, отсутствующий в источнике"
                    )
                skipped += 1
                continue
            fields = {
                "status": source.status,
                "final_time_seconds": source.final_time_seconds,
            }
            if (
                source.stage_number == last_stage
                and participant.summary.status == StageResultStatus.FINISHED
            ):
                fields["place"] = participant.summary.source_place
            if result is None:
                session.add(
                    StageResult(
                        protocol_id=protocol.id,
                        race_participant_id=entry.id,
                        **fields,
                    )
                )
                prepared.created["stage_results"] += 1
            else:
                _check_fields(result, fields, context)
    await session.flush()
    return skipped


async def _import_penalties(
    session: AsyncSession,
    data: CompleteProtocolImportData,
    prepared: PreparedProtocolImport,
) -> None:
    existing = await session.scalars(
        select(Penalty).where(
            Penalty.race_participant_id.in_(
                [entry.id for entry in prepared.entries.values()]
            )
        )
    )
    by_entry = defaultdict(list)
    for penalty in existing:
        by_entry[penalty.race_participant_id].append(penalty)
    for participant in data.participants:
        entry = prepared.entries[participant.start_number]
        expected = Counter(
            (penalty.seconds, penalty.raw_note, penalty.rule_reference)
            for penalty in participant.penalties
        )
        found = Counter(
            (penalty.seconds, penalty.reason, penalty.rule_reference)
            for penalty in by_entry[entry.id]
        )
        if found:
            if found != expected:
                raise ValueError(
                    f"Участник №{participant.start_number}: "
                    "штрафы в БД не совпадают с JSON"
                )
            continue
        for source in participant.penalties:
            session.add(
                Penalty(
                    race_participant_id=entry.id,
                    seconds=source.seconds,
                    rule_reference=source.rule_reference,
                    reason=source.raw_note,
                )
            )
            prepared.created["penalties"] += 1
    await session.flush()


async def import_protocol(
    session: AsyncSession, document: dict
) -> ProtocolImportResult:
    """Проверяет и переносит полный протокол внутри транзакции вызывающего кода.

    Создаёт черновики протоколов, сохраняет явные результаты и штрафы за гонку.
    Ожидаемые пустые результаты после DNF/DNS пропускает. Время берёт из источника.
    """
    data = CompleteProtocolImportData.model_validate(document)
    prepared = await prepare_protocol_import(session, document)
    metadata = data.protocol_metadata.model_dump()
    protocols = {}
    for stage_number, stage in prepared.stages.items():
        for code, discipline in prepared.disciplines.items():
            protocols[stage_number, code] = await _get_or_create(
                session,
                Protocol,
                {"stage_id": stage.id, "discipline_id": discipline.id},
                {**metadata, "source_filename": data.source_filename},
                prepared.created,
                f"Протокол этапа {stage_number}, дисциплина {code}",
            )
    skipped = await _import_stage_results(session, data, prepared, protocols)
    await _import_penalties(session, data, prepared)
    return ProtocolImportResult(
        race_id=prepared.race.id,
        created=prepared.created,
        skipped_stage_results=skipped,
        warnings=data.protocol_metadata.warnings,
    )
