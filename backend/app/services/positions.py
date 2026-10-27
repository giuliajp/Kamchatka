"""
Положение участников на карте по данным трекеров (задача 3.1).

Правила брифа и ответов заказчика:
- Положение — это ПОСЛЕДНЯЯ ПОДТВЕРЖДЁННАЯ ТОЧКА и всегда со временем («Положение на 14:32»).
- Нет новых точек дольше порога (stale_after_minutes, по умолчанию 45 мин) → is_stale.
  Это НЕ «остановился» и НЕ «сошёл»: просто данных нет.
- Скорость — средняя между двумя последними точками, а не мгновенная с устройства.
- «Позиция по GPS-трекеру» — порядок внутри дисциплины по километру на трассе.
  Это не официальное место: официальное — только протокол судей.
- Батарею и SOS в публичную часть не отдаём.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Discipline, Protocol, Race, RaceParticipant, Stage, StageStatus, TrackerPosition,
)
from app.services.route_profile import haversine_km
from app.services.route_progress import Route, route_for_stage
from app.services.standings import load_race_entries


@dataclass
class ParticipantPosition:
    entry: RaceParticipant
    last: TrackerPosition | None
    previous: TrackerPosition | None
    km: float | None = None                 # км от старта этапа по трассе
    avg_speed_kmh: float | None = None
    is_stale: bool = False
    gps_rank: int | None = None
    gap_to_leader_km: float | None = None


def pick_stage(stages: list[Stage], now: datetime, number: int | None) -> Stage | None:
    """Этап по номеру; без номера — текущий (идёт сейчас), иначе последний начавшийся, иначе первый."""
    if not stages:
        return None
    if number is not None:
        return next((s for s in stages if s.number == number), None)
    live = [s for s in stages if s.status == StageStatus.LIVE]
    if live:
        return live[-1]
    started = [s for s in stages if s.start_at is not None and s.start_at <= now]
    return started[-1] if started else stages[0]


async def last_two_points(session: AsyncSession, stage_id: int) -> dict[int, list[TrackerPosition]]:
    """По каждому участнику этапа — две последние точки (новая первой)."""
    ranked = (
        select(
            TrackerPosition.id,
            func.row_number().over(
                partition_by=TrackerPosition.race_participant_id,
                order_by=TrackerPosition.position_at.desc(),
            ).label("n"),
        )
        .where(TrackerPosition.stage_id == stage_id,
               TrackerPosition.race_participant_id.is_not(None))
        .subquery()
    )
    rows = (await session.execute(
        select(TrackerPosition)
        .join(ranked, ranked.c.id == TrackerPosition.id)
        .where(ranked.c.n <= 2)
        .order_by(TrackerPosition.race_participant_id, TrackerPosition.position_at.desc())
    )).scalars()
    result: dict[int, list[TrackerPosition]] = {}
    for position in rows:
        result.setdefault(position.race_participant_id, []).append(position)
    return result


def average_speed(route: Route, last: TrackerPosition, previous: TrackerPosition | None,
                  km_last: float | None) -> float | None:
    """Средняя скорость на отрезке между двумя точками, км/ч. По трассе, если обе точки на ней."""
    if previous is None:
        return None
    hours = (last.position_at - previous.position_at).total_seconds() / 3600
    if hours <= 0:
        return None
    on_route = route.locate(previous.latitude, previous.longitude)
    if km_last is not None and on_route is not None and km_last >= on_route.km:
        distance = km_last - on_route.km
    else:
        distance = haversine_km(previous.longitude, previous.latitude, last.longitude, last.latitude)
    return round(distance / hours, 1)


async def stage_positions(
    session: AsyncSession, race: Race, stage: Stage, now: datetime,
    discipline_code: str | None = None,
) -> list[ParticipantPosition]:
    entries = await load_race_entries(session, race.id)
    if discipline_code:
        entries = [e for e in entries if e.discipline.code == discipline_code]
    points = await last_two_points(session, stage.id)
    route = route_for_stage(stage)
    stale_after = timedelta(minutes=stage.stale_after_minutes or race.stale_after_minutes)

    result = []
    for entry in entries:
        pair = points.get(entry.id, [])
        last = pair[0] if pair else None
        previous = pair[1] if len(pair) > 1 else None
        item = ParticipantPosition(entry, last, previous)
        if last is not None:
            located = route.locate(last.latitude, last.longitude)
            item.km = round(located.km, 2) if located else None
            item.avg_speed_kmh = average_speed(route, last, previous, located.km if located else None)
            item.is_stale = now - last.position_at > stale_after
        result.append(item)

    # Позиция по GPS — внутри каждой дисциплины, по километру на трассе.
    by_discipline: dict[int, list[ParticipantPosition]] = {}
    for item in result:
        if item.km is not None:
            by_discipline.setdefault(item.entry.discipline_id, []).append(item)
    for group in by_discipline.values():
        group.sort(key=lambda i: (-i.km, i.last.position_at))
        leader_km = group[0].km
        for rank, item in enumerate(group, start=1):
            item.gps_rank = rank
            item.gap_to_leader_km = round(leader_km - item.km, 2)
    return result


async def published_disciplines(session: AsyncSession, stage_id: int) -> list[str]:
    """Коды дисциплин, по которым протокол этапа опубликован (после этого — только протокол)."""
    rows = await session.execute(
        select(Discipline.code)
        .join(Protocol, Protocol.discipline_id == Discipline.id)
        .where(Protocol.stage_id == stage_id, Protocol.published_at.is_not(None))
        .order_by(Discipline.sort_order)
    )
    return list(rows.scalars())
