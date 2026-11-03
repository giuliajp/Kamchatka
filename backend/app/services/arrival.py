"""
Ожидаемое время прибытия лидеров на финиш этапа («≈16:00 – 16:30*»).

Только оценка по GPS-трекерам — не официальное время. Берём лидера каждой дисциплины
по GPS, остаток пути по треку и скорость: среднюю на последнем отрезке, а если её нет —
среднюю с начала этапа. Окно ±15 % скорости, округлено до 10 минут.
Оценки нет, если этап не идёт, нет трека, точек или точка устарела.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Race, Stage, StageStatus
from app.services.positions import stage_positions
from app.services.route_progress import route_for_stage

SPREAD = 0.15
STEP_MINUTES = 10


def _round(moment: datetime, up: bool) -> datetime:
    base = moment.replace(second=0, microsecond=0)
    extra = base.minute % STEP_MINUTES
    if extra == 0 and moment == base:
        return base
    if up:
        return base + timedelta(minutes=STEP_MINUTES - extra)
    return base - timedelta(minutes=extra)


async def leaders_arrival(session: AsyncSession, race: Race, stage: Stage, now: datetime) -> list[dict]:
    if stage.status != StageStatus.LIVE:
        return []
    route = route_for_stage(stage)
    if route.length_km <= 0:
        return []
    estimates = []
    for item in await stage_positions(session, race, stage, now):
        if item.gps_rank != 1 or item.km is None or item.is_stale:
            continue
        speed = item.avg_speed_kmh
        if (not speed or speed < 1) and stage.start_at and item.last.position_at > stage.start_at:
            hours = (item.last.position_at - stage.start_at).total_seconds() / 3600
            speed = item.km / hours if hours > 0 else None
        remaining = max(route.length_km - item.km, 0)
        if not speed or speed < 1:
            continue
        eta = item.last.position_at + timedelta(hours=remaining / speed)
        earliest = item.last.position_at + timedelta(hours=remaining / (speed * (1 + SPREAD)))
        latest = item.last.position_at + timedelta(hours=remaining / (speed * (1 - SPREAD)))
        estimates.append({
            "discipline": {"id": item.entry.discipline.id, "code": item.entry.discipline.code,
                           "name": item.entry.discipline.name},
            "race_participant_id": item.entry.id, "start_number": item.entry.start_number,
            "full_name": item.entry.participant.full_name,
            "remaining_km": round(remaining, 1), "position_at": item.last.position_at,
            "expected_at": eta, "from": _round(max(earliest, now), up=False), "to": _round(max(latest, now), up=True),
        })
    estimates.sort(key=lambda e: e["expected_at"])
    return estimates
