"""
Админка: наполнение гонки (задача 3.5). Только для организаторов.

Гонки (режим «до гонки / идёт / завершена», текущая гонка), дисциплины (справочник),
этапы, места КП и их порядок на этапе, трек этапа из KML/KMZ/GPX (можно заменить во время
гонки), участники и их карточки, трекеры Iridium и привязка к участникам.
Всё меняется без разработчика и без выпуска новой версии приложения.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import exists, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload

from app.api.deps import AdminDep, SessionDep
from app.api.presenters import discipline_short, race_short, stage_short
from app.config import get_settings
from app.models import (
    Checkpoint, CheckpointPass, CheckpointRole, Discipline, Equipment, Participant, Protocol, Race,
    RaceParticipant, RaceParticipantStatus, RaceStatus, Stage, StageCheckpoint, StageResult,
    StageStatus, TrackerAssignment, TrackerDevice, TrackerPosition,
)
from app.models.base import utcnow
from app.schemas.common import ok
from app.services import push
from app.services.route_file import RouteFileError, parse_route, safe_filename
from app.services.route_profile import extract_lines, haversine_km

router = APIRouter(prefix="/admin", tags=["Админка: гонка, этапы, участники, трекеры"])


async def commit_or_conflict(session, message: str) -> None:
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail=message) from None


async def get_or_404(session, model, item_id: int, message: str):
    item = await session.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=message)
    return item


def apply(item, data: dict) -> None:
    for field, value in data.items():
        if isinstance(value, datetime) and value.tzinfo is not None:
            value = value.astimezone(UTC)               # в базе и в ответах — UTC
        setattr(item, field, value)


# ── Гонки ──────────────────────────────────────────────────────────────

class RaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    year: int = Field(ge=2000, le=2100)
    start_date: date | None = None
    end_date: date | None = None
    location: str | None = Field(None, max_length=200)
    tracking_interval_minutes: int = Field(20, ge=1, le=1440)
    stale_after_minutes: int = Field(45, ge=1, le=2880)


class RacePatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    location: str | None = Field(None, max_length=200)
    status: RaceStatus | None = Field(None, description="upcoming — до гонки, live — идёт, finished — завершена")
    is_current: bool | None = Field(None, description="true — эту гонку приложение показывает по умолчанию")
    tracking_interval_minutes: int | None = Field(None, ge=1, le=1440)
    stale_after_minutes: int | None = Field(None, ge=1, le=2880)


def race_out(race: Race) -> dict:
    return {**race_short(race), "tracking_interval_minutes": race.tracking_interval_minutes,
            "stale_after_minutes": race.stale_after_minutes}


@router.get("/races", summary="Все гонки (сезоны)")
async def list_races(session: SessionDep, admin: AdminDep):
    return ok([race_out(r) for r in await session.scalars(select(Race).order_by(Race.year.desc()))])


@router.post("/races", status_code=201, summary="Новая гонка (сезон)")
async def create_race(body: RaceIn, session: SessionDep, admin: AdminDep):
    race = Race(**body.model_dump(), status=RaceStatus.UPCOMING)
    session.add(race)
    await commit_or_conflict(session, f"Гонка {body.year} года уже есть")
    return ok(race_out(race))


@router.patch("/races/{race_id}", summary="Изменить гонку, режим и текущую гонку")
async def patch_race(race_id: int, body: RacePatch, session: SessionDep, admin: AdminDep):
    race = await get_or_404(session, Race, race_id, "Гонка не найдена")
    data = body.model_dump(exclude_unset=True)
    if data.get("is_current"):
        await session.execute(update(Race).where(Race.id != race.id).values(is_current=False))
    apply(race, data)
    if race.start_date and race.end_date and race.end_date < race.start_date:
        raise HTTPException(status_code=422, detail="Дата окончания раньше даты начала")
    await session.commit()
    return ok(race_out(race))


# ── Дисциплины ─────────────────────────────────────────────────────────

class DisciplineIn(BaseModel):
    code: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=200)
    equipment: Equipment
    dogs_min: int = Field(ge=1)
    dogs_max: int | None = Field(None, ge=1)
    sort_order: int = Field(0, ge=0)


class DisciplinePatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    dogs_min: int | None = Field(None, ge=1)
    dogs_max: int | None = Field(None, ge=1)
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


def discipline_out(d: Discipline) -> dict:
    return {**discipline_short(d), "equipment": d.equipment.value, "dogs_min": d.dogs_min,
            "dogs_max": d.dogs_max, "sort_order": d.sort_order, "is_active": d.is_active}


@router.get("/disciplines", summary="Справочник дисциплин")
async def list_disciplines(session: SessionDep, admin: AdminDep):
    return ok([discipline_out(d) for d in await session.scalars(
        select(Discipline).order_by(Discipline.sort_order, Discipline.id))])


@router.post("/disciplines", status_code=201, summary="Новая дисциплина")
async def create_discipline(body: DisciplineIn, session: SessionDep, admin: AdminDep):
    if body.dogs_max is not None and body.dogs_max < body.dogs_min:
        raise HTTPException(status_code=422, detail="Максимум собак меньше минимума")
    item = Discipline(**body.model_dump())
    session.add(item)
    await commit_or_conflict(session, "Дисциплина с таким кодом уже есть")
    return ok(discipline_out(item))


@router.patch("/disciplines/{discipline_id}", summary="Изменить дисциплину (код не меняется)")
async def patch_discipline(discipline_id: int, body: DisciplinePatch, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, Discipline, discipline_id, "Дисциплина не найдена")
    apply(item, body.model_dump(exclude_unset=True))
    if item.dogs_max is not None and item.dogs_max < item.dogs_min:
        raise HTTPException(status_code=422, detail="Максимум собак меньше минимума")
    await commit_or_conflict(session, "Не удалось сохранить дисциплину")
    return ok(discipline_out(item))


# ── Этапы ──────────────────────────────────────────────────────────────

class StageIn(BaseModel):
    number: int = Field(ge=1)
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    distance_km: float | None = Field(None, gt=0)
    start_at: AwareDatetime | None = None
    finish_at: AwareDatetime | None = None
    tracking_interval_minutes: int | None = Field(None, ge=1, le=1440)
    stale_after_minutes: int | None = Field(None, ge=1, le=2880)


class StagePatch(BaseModel):
    number: int | None = Field(None, ge=1)
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    distance_km: float | None = Field(None, gt=0)
    start_at: AwareDatetime | None = None
    finish_at: AwareDatetime | None = None
    status: StageStatus | None = None
    tracking_interval_minutes: int | None = Field(None, ge=1, le=1440)
    stale_after_minutes: int | None = Field(None, ge=1, le=2880)


def route_length_km(geojson) -> float | None:
    total = 0.0
    for line in extract_lines(geojson):
        for a, b in zip(line, line[1:]):
            total += haversine_km(a[0], a[1], b[0], b[1])
    return round(total, 2) if geojson else None


def stage_out(stage: Stage) -> dict:
    return {**stage_short(stage), "race_id": stage.race_id, "description": stage.description,
            "tracking_interval_minutes": stage.tracking_interval_minutes,
            "stale_after_minutes": stage.stale_after_minutes,
            "route_source_filename": stage.route_source_filename,
            "route_updated_at": stage.route_updated_at,
            "route_length_km": route_length_km(stage.route_geojson)}


def check_stage_times(start: datetime | None, finish: datetime | None) -> None:
    if start and finish and finish < start:
        raise HTTPException(status_code=422, detail="Финиш этапа раньше старта")


@router.get("/races/{race_id}/stages", summary="Этапы гонки")
async def list_stages(race_id: int, session: SessionDep, admin: AdminDep):
    return ok([stage_out(s) for s in await session.scalars(
        select(Stage).where(Stage.race_id == race_id).order_by(Stage.number))])


@router.post("/races/{race_id}/stages", status_code=201, summary="Новый этап")
async def create_stage(race_id: int, body: StageIn, session: SessionDep, admin: AdminDep):
    await get_or_404(session, Race, race_id, "Гонка не найдена")
    check_stage_times(body.start_at, body.finish_at)
    stage = Stage(race_id=race_id)
    apply(stage, body.model_dump())
    session.add(stage)
    await commit_or_conflict(session, f"Этап {body.number} уже есть")
    return ok(stage_out(stage))


@router.patch("/stages/{stage_id}", summary="Изменить этап; status=live — старт этапа (уходит push)")
async def patch_stage(stage_id: int, body: StagePatch, session: SessionDep, admin: AdminDep):
    stage = await get_or_404(session, Stage, stage_id, "Этап не найден")
    was_live = stage.status == StageStatus.LIVE
    apply(stage, body.model_dump(exclude_unset=True))
    check_stage_times(stage.start_at, stage.finish_at)
    if stage.status == StageStatus.LIVE and not was_live:
        started = stage.start_at or utcnow()
        title = f"Этап {stage.number}" + (f" «{stage.name}»" if stage.name else "")
        await push.send(session, segment="all", trigger="stage_start", fragment=f"map&stage={stage.id}",
                        created_by=admin.full_name,
                        message=f"{title} стартовал в {push.kamchatka_time(started)} по Камчатке. "
                                "Положение участников — на карте.")
    await commit_or_conflict(session, "Этап с таким номером уже есть")
    return ok(stage_out(stage))


@router.delete("/stages/{stage_id}", summary="Удалить этап (только пустой)")
async def delete_stage(stage_id: int, session: SessionDep, admin: AdminDep):
    stage = await get_or_404(session, Stage, stage_id, "Этап не найден")
    used = await session.scalar(select(
        exists().where(Protocol.stage_id == stage.id) | exists().where(TrackerPosition.stage_id == stage.id)))
    if used:
        raise HTTPException(status_code=409, detail="У этапа есть протоколы или точки трекинга — удалить нельзя")
    out = stage_out(stage)
    await session.delete(stage)
    await commit_or_conflict(session, "Этап используется в программе или локациях — сначала уберите ссылки")
    return ok(out)


@router.put("/stages/{stage_id}/route", summary="Загрузить или заменить трек этапа (KML, KMZ, GPX)")
async def upload_route(stage_id: int, session: SessionDep, admin: AdminDep,
                       file: UploadFile = File(description="KML, KMZ или GPX")):
    stage = await get_or_404(session, Stage, stage_id, "Этап не найден")
    try:
        parsed = parse_route(await file.read())
    except RouteFileError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    stage.route_geojson = parsed["geojson"]
    stage.route_source_filename = safe_filename(file.filename, "route.kml")
    stage.route_updated_at = utcnow()
    await session.commit()
    return ok({**stage_out(stage), "has_elevation": parsed["has_elevation"],
               "points_in_file": parsed["points"]})


@router.delete("/stages/{stage_id}/route", summary="Убрать трек этапа")
async def delete_route(stage_id: int, session: SessionDep, admin: AdminDep):
    stage = await get_or_404(session, Stage, stage_id, "Этап не найден")
    stage.route_geojson = stage.route_source_filename = None
    stage.route_updated_at = utcnow()
    await session.commit()
    return ok(stage_out(stage))


# ── Места КП и КП этапа ────────────────────────────────────────────────

class CheckpointIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation_m: float | None = None


class CheckpointPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    elevation_m: float | None = None


class StageCheckpointIn(BaseModel):
    checkpoint_id: int
    order_index: int = Field(ge=0, description="0 — старт, дальше по порядку")
    role: CheckpointRole = CheckpointRole.CHECKPOINT
    label: str | None = Field(None, max_length=50, examples=["КП-3"])
    km_from_start: float | None = Field(None, ge=0)
    required_rest_minutes: int = Field(0, ge=0)


class StageCheckpointPatch(BaseModel):
    order_index: int | None = Field(None, ge=0)
    role: CheckpointRole | None = None
    label: str | None = Field(None, max_length=50)
    km_from_start: float | None = Field(None, ge=0)
    required_rest_minutes: int | None = Field(None, ge=0)


def checkpoint_out(c: Checkpoint) -> dict:
    return {"id": c.id, "name": c.name, "description": c.description, "latitude": c.latitude,
            "longitude": c.longitude, "elevation_m": c.elevation_m}


def stage_checkpoint_out(sc: StageCheckpoint) -> dict:
    return {"id": sc.id, "stage_id": sc.stage_id, "checkpoint_id": sc.checkpoint_id,
            "order_index": sc.order_index, "role": sc.role.value, "label": sc.label,
            "km_from_start": sc.km_from_start, "required_rest_minutes": sc.required_rest_minutes}


@router.get("/checkpoints", summary="Все места КП")
async def list_checkpoints(session: SessionDep, admin: AdminDep):
    return ok([checkpoint_out(c) for c in await session.scalars(select(Checkpoint).order_by(Checkpoint.name))])


@router.post("/checkpoints", status_code=201, summary="Новое место КП")
async def create_checkpoint(body: CheckpointIn, session: SessionDep, admin: AdminDep):
    item = Checkpoint(**body.model_dump())
    session.add(item)
    await commit_or_conflict(session, "Место с таким названием уже есть")
    return ok(checkpoint_out(item))


@router.patch("/checkpoints/{checkpoint_id}", summary="Изменить место КП")
async def patch_checkpoint(checkpoint_id: int, body: CheckpointPatch, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, Checkpoint, checkpoint_id, "Место не найдено")
    apply(item, body.model_dump(exclude_unset=True))
    await commit_or_conflict(session, "Место с таким названием уже есть")
    return ok(checkpoint_out(item))


@router.get("/stages/{stage_id}/checkpoints", summary="КП этапа по порядку")
async def list_stage_checkpoints(stage_id: int, session: SessionDep, admin: AdminDep):
    items = await session.scalars(select(StageCheckpoint).where(StageCheckpoint.stage_id == stage_id)
                                  .order_by(StageCheckpoint.order_index))
    return ok([stage_checkpoint_out(sc) for sc in items])


@router.post("/stages/{stage_id}/checkpoints", status_code=201, summary="Добавить КП на этап")
async def create_stage_checkpoint(stage_id: int, body: StageCheckpointIn, session: SessionDep, admin: AdminDep):
    await get_or_404(session, Stage, stage_id, "Этап не найден")
    await get_or_404(session, Checkpoint, body.checkpoint_id, "Место не найдено")
    item = StageCheckpoint(stage_id=stage_id, **body.model_dump())
    session.add(item)
    await commit_or_conflict(session, "На этапе уже есть КП с таким порядковым номером")
    return ok(stage_checkpoint_out(item))


@router.patch("/stage-checkpoints/{item_id}", summary="Изменить КП этапа")
async def patch_stage_checkpoint(item_id: int, body: StageCheckpointPatch, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, StageCheckpoint, item_id, "КП этапа не найден")
    apply(item, body.model_dump(exclude_unset=True))
    await commit_or_conflict(session, "На этапе уже есть КП с таким порядковым номером")
    return ok(stage_checkpoint_out(item))


@router.delete("/stage-checkpoints/{item_id}", summary="Убрать КП с этапа (если нет отметок)")
async def delete_stage_checkpoint(item_id: int, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, StageCheckpoint, item_id, "КП этапа не найден")
    if await session.scalar(select(exists().where(CheckpointPass.stage_checkpoint_id == item.id))):
        raise HTTPException(status_code=409, detail="На этом КП есть отметки судей — удалить нельзя")
    out = stage_checkpoint_out(item)
    await session.delete(item)
    await session.commit()
    return ok(out)


# ── Участники ──────────────────────────────────────────────────────────

class EntryIn(BaseModel):
    participant_id: int | None = Field(None, description="Спортсмен из прошлых лет; иначе — ФИО ниже")
    last_name: str | None = Field(None, max_length=100)
    first_name: str | None = Field(None, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    birth_year: int | None = Field(None, ge=1900, le=2100)
    photo_url: str | None = Field(None, max_length=500)
    bio: str | None = None
    discipline_id: int
    start_number: int = Field(ge=1)
    region: str | None = Field(None, max_length=200)
    dogs_count: int | None = Field(None, ge=1)


class EntryPatch(BaseModel):
    discipline_id: int | None = None
    start_number: int | None = Field(None, ge=1)
    region: str | None = Field(None, max_length=200)
    dogs_count: int | None = Field(None, ge=1)
    status: RaceParticipantStatus | None = None


class PersonPatch(BaseModel):
    last_name: str | None = Field(None, min_length=1, max_length=100)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    birth_year: int | None = Field(None, ge=1900, le=2100)
    photo_url: str | None = Field(None, max_length=500)
    bio: str | None = None


def entry_out(e: RaceParticipant) -> dict:
    p = e.participant
    return {"id": e.id, "race_id": e.race_id, "start_number": e.start_number, "status": e.status.value,
            "region": e.region, "dogs_count": e.dogs_count, "discipline": discipline_short(e.discipline),
            "participant": {"id": p.id, "last_name": p.last_name, "first_name": p.first_name,
                            "middle_name": p.middle_name, "full_name": p.full_name, "birth_year": p.birth_year,
                            "photo_url": p.photo_url, "bio": p.bio}}


async def load_entry(session, entry_id: int) -> RaceParticipant:
    entry = await session.scalar(select(RaceParticipant).where(RaceParticipant.id == entry_id).options(
        selectinload(RaceParticipant.participant), selectinload(RaceParticipant.discipline)))
    if entry is None:
        raise HTTPException(status_code=404, detail="Участник гонки не найден")
    return entry


@router.get("/races/{race_id}/participants", summary="Участники гонки с карточками")
async def list_entries(race_id: int, session: SessionDep, admin: AdminDep):
    items = await session.scalars(select(RaceParticipant).where(RaceParticipant.race_id == race_id).options(
        selectinload(RaceParticipant.participant), selectinload(RaceParticipant.discipline))
        .order_by(RaceParticipant.start_number))
    return ok([entry_out(e) for e in items])


@router.get("/participants", summary="Поиск спортсменов прошлых лет по фамилии")
async def search_people(session: SessionDep, admin: AdminDep, q: str = ""):
    stmt = select(Participant).order_by(Participant.last_name, Participant.first_name).limit(50)
    if q.strip():
        stmt = stmt.where(Participant.last_name.ilike(f"{q.strip()}%"))
    return ok([{"id": p.id, "full_name": p.full_name, "birth_year": p.birth_year}
               for p in await session.scalars(stmt)])


@router.post("/races/{race_id}/participants", status_code=201, summary="Добавить участника в гонку")
async def create_entry(race_id: int, body: EntryIn, session: SessionDep, admin: AdminDep):
    await get_or_404(session, Race, race_id, "Гонка не найдена")
    await get_or_404(session, Discipline, body.discipline_id, "Дисциплина не найдена")
    if body.participant_id is not None:
        person = await get_or_404(session, Participant, body.participant_id, "Спортсмен не найден")
    else:
        if not body.last_name or not body.first_name:
            raise HTTPException(status_code=422, detail="Укажите фамилию и имя или participant_id")
        person = Participant(last_name=body.last_name, first_name=body.first_name, middle_name=body.middle_name,
                             birth_year=body.birth_year, photo_url=body.photo_url, bio=body.bio)
        session.add(person)
        await session.flush()
    entry = RaceParticipant(race_id=race_id, participant_id=person.id, discipline_id=body.discipline_id,
                            start_number=body.start_number, region=body.region, dogs_count=body.dogs_count)
    session.add(entry)
    await commit_or_conflict(session, "Стартовый номер занят или спортсмен уже заявлен в эту гонку")
    return ok(entry_out(await load_entry(session, entry.id)))


@router.patch("/race-participants/{entry_id}", summary="Изменить заявку: номер, дисциплина, регион, статус")
async def patch_entry(entry_id: int, body: EntryPatch, session: SessionDep, admin: AdminDep):
    entry = await load_entry(session, entry_id)
    data = body.model_dump(exclude_unset=True)
    if "discipline_id" in data and data["discipline_id"] != entry.discipline_id:
        if await session.scalar(select(exists().where(StageResult.race_participant_id == entry.id))):
            raise HTTPException(status_code=409, detail="У участника есть результаты — дисциплину не сменить")
        await get_or_404(session, Discipline, data["discipline_id"], "Дисциплина не найдена")
    apply(entry, data)
    await commit_or_conflict(session, "Стартовый номер уже занят")
    return ok(entry_out(await load_entry(session, entry_id)))


@router.patch("/participants/{participant_id}", summary="Карточка спортсмена: ФИО, фото, биография")
async def patch_person(participant_id: int, body: PersonPatch, session: SessionDep, admin: AdminDep):
    person = await get_or_404(session, Participant, participant_id, "Спортсмен не найден")
    apply(person, body.model_dump(exclude_unset=True))
    await session.commit()
    return ok({"id": person.id, "full_name": person.full_name, "birth_year": person.birth_year,
               "photo_url": person.photo_url, "bio": person.bio})


@router.delete("/race-participants/{entry_id}", summary="Убрать ошибочную заявку (если нет результатов)")
async def delete_entry(entry_id: int, session: SessionDep, admin: AdminDep):
    entry = await load_entry(session, entry_id)
    if await session.scalar(select(exists().where(StageResult.race_participant_id == entry.id))):
        raise HTTPException(status_code=409, detail="Участник есть в протоколах — его не удаляют, ставят DNS/DNF")
    if await session.scalar(select(exists().where(CheckpointPass.race_participant_id == entry.id)
                                   | exists().where(TrackerPosition.race_participant_id == entry.id))):
        raise HTTPException(status_code=409, detail="У участника есть отметки КП или точки трекинга — удалить нельзя")
    out = entry_out(entry)
    await session.execute(update(TrackerAssignment).where(TrackerAssignment.race_participant_id == entry.id)
                          .values(valid_to=func.coalesce(TrackerAssignment.valid_to, utcnow())))
    await session.delete(entry)
    await commit_or_conflict(session, "У участника есть точки трекинга или отметки — удалить нельзя")
    return ok(out)


# ── Трекеры ────────────────────────────────────────────────────────────

class TrackerIn(BaseModel):
    imei: str = Field(pattern=r"^\d{15}$")
    name: str | None = Field(None, max_length=100)


class TrackerPatch(BaseModel):
    name: str | None = Field(None, max_length=100)
    is_active: bool | None = Field(None, description="false — точки с трекера не принимаются")


class AssignIn(BaseModel):
    race_participant_id: int
    stage_id: int | None = Field(None, description="Пусто — на всю гонку")
    valid_from: AwareDatetime | None = Field(None, description="Пусто — с этого момента")


async def tracker_out(session, device: TrackerDevice) -> dict:
    now = utcnow()
    current = await session.scalar(
        select(TrackerAssignment).where(TrackerAssignment.tracker_device_id == device.id,
                                        or_(TrackerAssignment.valid_to.is_(None), TrackerAssignment.valid_to > now))
        .options(selectinload(TrackerAssignment.race_participant).selectinload(RaceParticipant.participant))
        .order_by(TrackerAssignment.valid_from.desc()).limit(1))
    assigned = None
    if current is not None:
        entry = current.race_participant
        assigned = {"assignment_id": current.id, "race_participant_id": entry.id, "race_id": entry.race_id,
                    "start_number": entry.start_number, "full_name": entry.participant.full_name,
                    "stage_id": current.stage_id, "valid_from": current.valid_from}
    return {"id": device.id, "imei": device.imei, "name": device.name, "is_active": device.is_active,
            "assigned_to": assigned}


@router.get("/trackers", summary="Трекеры и кому они выданы")
async def list_trackers(session: SessionDep, admin: AdminDep):
    devices = (await session.scalars(select(TrackerDevice).order_by(TrackerDevice.imei))).all()
    return ok([await tracker_out(session, d) for d in devices])


@router.post("/trackers", status_code=201, summary="Добавить трекер вручную (обычно появляется сам из Iridium)")
async def create_tracker(body: TrackerIn, session: SessionDep, admin: AdminDep):
    device = TrackerDevice(imei=body.imei, name=body.name, is_active=True)
    session.add(device)
    await commit_or_conflict(session, "Трекер с таким IMEI уже есть")
    return ok(await tracker_out(session, device))


@router.patch("/trackers/{tracker_id}", summary="Название трекера, включить или выключить")
async def patch_tracker(tracker_id: int, body: TrackerPatch, session: SessionDep, admin: AdminDep):
    device = await get_or_404(session, TrackerDevice, tracker_id, "Трекер не найден")
    apply(device, body.model_dump(exclude_unset=True))
    await session.commit()
    return ok(await tracker_out(session, device))


@router.post("/trackers/{tracker_id}/assign", summary="Выдать трекер участнику (прошлая выдача закрывается)")
async def assign_tracker(tracker_id: int, body: AssignIn, session: SessionDep, admin: AdminDep):
    device = await get_or_404(session, TrackerDevice, tracker_id, "Трекер не найден")
    entry = await get_or_404(session, RaceParticipant, body.race_participant_id, "Участник гонки не найден")
    if body.stage_id is not None:
        stage = await get_or_404(session, Stage, body.stage_id, "Этап не найден")
        if stage.race_id != entry.race_id:
            raise HTTPException(status_code=422, detail="Этап из другой гонки")
    start = body.valid_from or utcnow()
    await session.execute(update(TrackerAssignment).where(
        TrackerAssignment.tracker_device_id == device.id,
        or_(TrackerAssignment.valid_to.is_(None), TrackerAssignment.valid_to > start)).values(valid_to=start))
    session.add(TrackerAssignment(tracker_device_id=device.id, race_participant_id=entry.id,
                                  stage_id=body.stage_id, valid_from=start.astimezone(UTC)))
    device.is_active = True
    await session.commit()
    return ok(await tracker_out(session, device))


@router.post("/trackers/{tracker_id}/unassign", summary="Забрать трекер у участника")
async def unassign_tracker(tracker_id: int, session: SessionDep, admin: AdminDep):
    device = await get_or_404(session, TrackerDevice, tracker_id, "Трекер не найден")
    now = utcnow()
    await session.execute(update(TrackerAssignment).where(
        TrackerAssignment.tracker_device_id == device.id,
        or_(TrackerAssignment.valid_to.is_(None), TrackerAssignment.valid_to > now)).values(valid_to=now))
    await session.commit()
    return ok(await tracker_out(session, device))


@router.post("/trackers/poll", summary="Запросить данные Iridium360 сейчас, не дожидаясь опроса")
async def poll_now(session: SessionDep, admin: AdminDep):
    if not get_settings().iridium360_api_key:
        raise HTTPException(status_code=503, detail="Не задан IRIDIUM360_API_KEY в backend/.env")
    from app.services.iridium360.client import Iridium360Client
    from app.services.iridium360.ingest import poll_once

    factory = async_sessionmaker(session.bind, expire_on_commit=False)
    async with Iridium360Client() as client:
        report = await poll_once(factory, client)
    # «Запрос принят» ≠ «устройство ответило»: показываем, что реально пришло.
    return ok({"summary": report.summary(), "skipped": report.skipped, "devices_seen": report.devices_seen,
               "new_devices": report.new_devices, "points_saved": report.points_saved, "errors": report.errors})
