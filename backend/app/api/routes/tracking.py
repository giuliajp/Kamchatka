"""
Карта: позиции участников и их треки по данным трекеров (задача 3.1).
Подключено в app/main.py с префиксом /api.

Фронтенд запрашивает позиции не реже раза в 2 минуты (бриф).
"""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.api.presenters import discipline_short, stage_short
from app.models import Race, RaceParticipant, Stage, TrackerPosition
from app.models.base import utcnow
from app.schemas.common import ApiResponse, ok
from app.schemas.tracking import ParticipantTrack, StagePositions
from app.services.positions import pick_stage, published_disciplines, stage_positions
from app.services.route_progress import route_for_stage

router = APIRouter(tags=["Карта"])


def point(p: TrackerPosition | None) -> dict | None:
    if p is None:
        return None
    return {"latitude": p.latitude, "longitude": p.longitude,
            "altitude_m": p.altitude_m, "position_at": p.position_at}


@router.get("/races/{race_id}/positions", response_model=ApiResponse[StagePositions],
            summary="Позиции участников на этапе (последняя подтверждённая точка трекера)")
async def race_positions(
    race_id: int,
    session: SessionDep,
    stage: int | None = Query(None, ge=1, description="Номер этапа; пусто — текущий"),
    discipline: str | None = Query(None, description="Код дисциплины; пусто — все"),
):
    race = await session.get(Race, race_id)
    if race is None:
        raise HTTPException(status_code=404, detail="Гонка не найдена")
    stages = list((await session.execute(
        select(Stage).where(Stage.race_id == race_id).order_by(Stage.number)
    )).scalars())
    now = utcnow()
    current = pick_stage(stages, now, stage)
    if current is None:
        raise HTTPException(status_code=404, detail="Этап не найден")

    items = await stage_positions(session, race, current, now, discipline)
    route = route_for_stage(current)
    return ok({
        "stage": stage_short(current),
        "generated_at": now,
        "tracking_interval_minutes": current.tracking_interval_minutes or race.tracking_interval_minutes,
        "stale_after_minutes": current.stale_after_minutes or race.stale_after_minutes,
        "route_length_km": round(route.length_km, 2) if route.length_km else None,
        "official_protocol_disciplines": await published_disciplines(session, current.id),
        "participants": [
            {
                "race_participant_id": i.entry.id,
                "participant_id": i.entry.participant.id,
                "start_number": i.entry.start_number,
                "full_name": i.entry.participant.full_name,
                "photo_url": i.entry.participant.photo_url,
                "discipline": discipline_short(i.entry.discipline),
                "position": point(i.last),
                "previous_position": point(i.previous),
                "is_stale": i.is_stale,
                "km_on_route": i.km,
                "avg_speed_kmh": i.avg_speed_kmh,
                "gps_rank": i.gps_rank,
                "gap_to_leader_km": i.gap_to_leader_km,
            }
            for i in items
        ],
    })


@router.get("/race-participants/{race_participant_id}/track",
            response_model=ApiResponse[ParticipantTrack],
            summary="Трек участника: все точки трекера (по этапу или за всю гонку)")
async def participant_track(
    race_participant_id: int,
    session: SessionDep,
    stage: int | None = Query(None, ge=1, description="Номер этапа; пусто — вся гонка"),
):
    entry = (await session.execute(
        select(RaceParticipant).where(RaceParticipant.id == race_participant_id)
        .options(selectinload(RaceParticipant.participant))
    )).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Участник гонки не найден")

    query = (
        select(TrackerPosition, Stage.number)
        .outerjoin(Stage, Stage.id == TrackerPosition.stage_id)
        .where(TrackerPosition.race_participant_id == entry.id)
        .order_by(TrackerPosition.position_at)
    )
    if stage is not None:
        query = query.where(Stage.number == stage)
    rows = (await session.execute(query)).all()
    return ok({
        "race_participant_id": entry.id,
        "start_number": entry.start_number,
        "full_name": entry.participant.full_name,
        "points": [{**point(p), "stage_number": number} for p, number in rows],
    })
