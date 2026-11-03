"""
Гонки, этапы гонки, участники гонки, общий зачёт (задачи 2.3, 2.4, 2.5).

Подключено в app/main.py с префиксом /api.
Результаты — только из ОПУБЛИКОВАННЫХ протоколов (Protocol.published_at не пусто).
"""

from enum import Enum

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from app.api.deps import SessionDep
from app.api.presenters import discipline_results, discipline_short, race_short, stage_short
from app.models import Discipline, Race, RaceParticipant, Stage
from app.schemas.common import ApiResponse, ok
from app.schemas.races import (
    ParticipantListItem, RaceDetail, RaceResults, RaceShort, StageShort,
)
from app.services.standings import (
    PENALTY_INCLUDED_IN_STAGE_TIMES, build_standings, format_duration,
)
from app.services.support import counts_with_change

router = APIRouter(tags=["Гонки"])


class ParticipantSort(str, Enum):
    start_number = "start_number"
    place = "place"
    name = "name"
    supporters = "supporters"   # больше болельщиков — выше


async def get_race_or_404(session, race_id: int) -> Race:
    race = await session.get(Race, race_id)
    if race is None:
        raise HTTPException(status_code=404, detail="Гонка не найдена")
    return race


async def race_detail(session, race: Race) -> dict:
    counts = dict((await session.execute(
        select(RaceParticipant.discipline_id, func.count())
        .where(RaceParticipant.race_id == race.id)
        .group_by(RaceParticipant.discipline_id)
    )).all())
    disciplines = (await session.execute(
        select(Discipline)
        .where(or_(Discipline.is_active.is_(True), Discipline.id.in_(list(counts) or [0])))
        .order_by(Discipline.sort_order, Discipline.id)
    )).scalars()
    stages = (await session.execute(
        select(Stage).where(Stage.race_id == race.id).order_by(Stage.number)
    )).scalars()
    return {
        **race_short(race),
        "disciplines": [
            {**discipline_short(d), "participants_count": counts.get(d.id, 0)} for d in disciplines
        ],
        "stages": [stage_short(s) for s in stages],
        "protocol_pdf_url": race.protocol_pdf_url,
    }


@router.get("/races", response_model=ApiResponse[list[RaceShort]],
            summary="Все гонки: текущая и архив (новые сверху)")
async def list_races(session: SessionDep):
    races = (await session.execute(select(Race).order_by(Race.year.desc()))).scalars()
    return ok([race_short(r) for r in races])


@router.get("/races/current", response_model=ApiResponse[RaceDetail],
            summary="Текущая гонка (если не отмечена — самая свежая)")
async def current_race(session: SessionDep):
    race = (await session.execute(
        select(Race).order_by(Race.is_current.desc(), Race.year.desc()).limit(1)
    )).scalar_one_or_none()
    if race is None:
        raise HTTPException(status_code=404, detail="Гонок пока нет")
    return ok(await race_detail(session, race))


@router.get("/races/{race_id}", response_model=ApiResponse[RaceDetail],
            summary="Гонка: статус, даты, дисциплины, этапы")
async def get_race(race_id: int, session: SessionDep):
    race = await get_race_or_404(session, race_id)
    return ok(await race_detail(session, race))


@router.get("/races/{race_id}/stages", response_model=ApiResponse[list[StageShort]],
            summary="Этапы гонки по порядку")
async def list_race_stages(race_id: int, session: SessionDep):
    await get_race_or_404(session, race_id)
    stages = (await session.execute(
        select(Stage).where(Stage.race_id == race_id).order_by(Stage.number)
    )).scalars()
    return ok([stage_short(s) for s in stages])


@router.get("/races/{race_id}/participants",
            response_model=ApiResponse[list[ParticipantListItem]],
            summary="Участники гонки: фильтр по дисциплине, поиск, сортировка")
async def list_race_participants(
    race_id: int,
    session: SessionDep,
    discipline: str | None = Query(None, description="Код дисциплины, например sled_8"),
    q: str | None = Query(None, description="Поиск по фамилии, имени или стартовому номеру"),
    sort: ParticipantSort = Query(ParticipantSort.start_number),
):
    await get_race_or_404(session, race_id)
    standings = await build_standings(session, race_id, discipline_code=discipline)
    supporters = await counts_with_change(session, race_id=race_id)

    items = []
    for standing in standings:
        for row in standing.rows:
            entry, person = row.entry, row.entry.participant
            items.append({
                "race_participant_id": entry.id,
                "participant_id": person.id,
                "start_number": entry.start_number,
                "full_name": person.full_name,
                "last_name": person.last_name,
                "first_name": person.first_name,
                "photo_url": person.photo_url,
                "region": entry.region,
                "discipline": discipline_short(entry.discipline),
                "dogs_count": entry.dogs_count,
                "dog_breed": entry.dog_breed,
                "status": row.status,
                "place": row.place,
                "total_time_seconds": row.total_seconds,
                "total_time": format_duration(row.total_seconds),
                "supporters_count": supporters.get(entry.id, (0, 0))[0],
                "supporters_change_24h": supporters.get(entry.id, (0, 0))[1],
                "_order": (standing.discipline.sort_order, standing.discipline.id),
            })

    if q and q.strip():
        needle = q.strip().casefold()
        items = [
            i for i in items
            if needle in i["full_name"].casefold() or needle == str(i["start_number"])
        ]

    if sort == ParticipantSort.place:
        # Места — только внутри дисциплины: сначала дисциплина, потом место.
        items.sort(key=lambda i: (i["_order"], i["place"] is None, i["place"] or 0,
                                  i["start_number"]))
    elif sort == ParticipantSort.supporters:
        items.sort(key=lambda i: (-i["supporters_count"], i["start_number"]))
    elif sort == ParticipantSort.name:
        items.sort(key=lambda i: (i["full_name"].casefold(), i["start_number"]))
    else:
        items.sort(key=lambda i: i["start_number"])

    for item in items:
        item.pop("_order")
    return ok(items)


@router.get("/races/{race_id}/results", response_model=ApiResponse[RaceResults],
            summary="Общий зачёт: отдельная таблица по каждой дисциплине")
async def race_results(
    race_id: int,
    session: SessionDep,
    discipline: str | None = Query(None, description="Код дисциплины; пусто — все"),
    stage: int | None = Query(None, ge=1, description="Зачёт после этапа N; пусто — по всем"),
):
    race = await get_race_or_404(session, race_id)
    standings = await build_standings(session, race_id, up_to_stage=stage,
                                      discipline_code=discipline)
    return ok({
        "race": race_short(race),
        "up_to_stage": stage,
        "penalty_included_in_stage_times": PENALTY_INCLUDED_IN_STAGE_TIMES,
        "disciplines": [discipline_results(s) for s in standings],
    })
