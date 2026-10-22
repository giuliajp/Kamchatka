"""
Один цикл опроса Iridium360: получить точки и сохранить в tracker_positions (задача 2.6).

Как работает цикл:
1. Если ни один трекер сейчас не привязан к участнику — ничего не запрашиваем (вне сезона).
2. /devices → все устройства и их последние точки (один запрос).
3. Если последняя точка устройства новее нашей последней сохранённой — значит, между
   опросами могли быть ещё точки (например, Iridium был недоступен). Догружаем трек
   этого устройства с нашей последней точки (point_id_from). Первый раз историю не тянем.
4. Каждую точку привязываем к участнику по TrackerAssignment на момент ВРЕМЕНИ ТОЧКИ
   и к этапу (из привязки или по времени старта/финиша этапа).
5. Сохраняем. Дубли отбрасывает база (уникальность: устройство + id точки; устройство + время).

Неизвестные устройства создаём выключенными (is_active = false) — организатор увидит
их в админке и привяжет. Точки устройств без привязки не сохраняем.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.models import (
    PositionSource, Stage, TrackerAssignment, TrackerDevice, TrackerPosition,
)
from app.models.base import utcnow
from app.services.iridium360.client import (
    Iridium360Client, Iridium360Error, IridiumDevice, IridiumPoint,
)

# Пишем в лог uvicorn, чтобы сообщения опроса были видны в терминале сервера.
logger = logging.getLogger("uvicorn.error").getChild("iridium360")


@dataclass
class PollReport:
    skipped: str | None = None          # причина, если цикл пропущен
    devices_seen: int = 0
    new_devices: list[str] = field(default_factory=list)   # IMEI
    tracks_requested: int = 0
    points_received: int = 0
    points_saved: int = 0
    points_unassigned: int = 0
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        if self.skipped:
            return f"Опрос пропущен: {self.skipped}"
        text = (f"Устройств: {self.devices_seen}, новых: {len(self.new_devices)}; "
                f"точек получено: {self.points_received}, сохранено: {self.points_saved}, "
                f"без привязки: {self.points_unassigned}; догрузок трека: {self.tracks_requested}")
        if self.errors:
            text += "; ошибки: " + " | ".join(self.errors)
        return text


async def has_open_assignments(session: AsyncSession, now: datetime) -> bool:
    found = await session.scalar(
        select(TrackerAssignment.id)
        .join(TrackerDevice, TrackerDevice.id == TrackerAssignment.tracker_device_id)
        .where(TrackerDevice.is_active.is_(True),
               or_(TrackerAssignment.valid_to.is_(None), TrackerAssignment.valid_to > now))
        .limit(1)
    )
    return found is not None


async def poll_once(
    session_factory: async_sessionmaker[AsyncSession],
    client: Iridium360Client,
    now: datetime | None = None,
) -> PollReport:
    """Один цикл. Ошибки связи с Iridium не падают наружу — попадают в отчёт."""
    now = now or utcnow()
    report = PollReport()

    async with session_factory() as session:
        if not await has_open_assignments(session, now):
            report.skipped = "нет активных привязок трекеров к участникам"
            return report

    try:
        devices = await client.fetch_devices()
    except Iridium360Error as error:
        report.errors.append(str(error))
        logger.warning("Iridium360: %s", error)
        return report
    report.devices_seen = len(devices)

    # Устройства в базе и наша последняя точка по каждому.
    async with session_factory.begin() as session:
        known = await _sync_devices(session, devices, report)
        last_ids = await _last_point_ids(session, [d.id for d in known.values()])

    # Сеть — вне транзакции: догружаем трек, если пропустили точки.
    points: dict[str, list[IridiumPoint]] = {}
    for device in devices:
        db_device = known[device.imei]
        if not db_device.is_active or device.last_position is None:
            continue
        received = [device.last_position, *device.track]
        last_id = last_ids.get(db_device.id)
        if device.number and last_id and device.last_position.id and device.last_position.id != last_id:
            try:
                received += await client.fetch_track(device.number, point_id_from=last_id)
                report.tracks_requested += 1
            except Iridium360Error as error:
                report.errors.append(f"{device.imei}: {error}")
        points[device.imei] = received

    async with session_factory.begin() as session:
        await _save_points(session, known, points, report)

    logger.info("Iridium360: %s", report.summary())
    return report


async def _sync_devices(session: AsyncSession, devices: list[IridiumDevice],
                        report: PollReport) -> dict[str, TrackerDevice]:
    imeis = [d.imei for d in devices]
    existing = {
        d.imei: d for d in (await session.execute(
            select(TrackerDevice).where(TrackerDevice.imei.in_(imeis or [""]))
        )).scalars()
    }
    for device in devices:
        db_device = existing.get(device.imei)
        if db_device is None:
            db_device = TrackerDevice(imei=device.imei, name=device.name, is_active=False)
            session.add(db_device)
            existing[device.imei] = db_device
            report.new_devices.append(device.imei)
        elif not db_device.name and device.name:
            db_device.name = device.name
    await session.flush()
    return existing


async def _last_point_ids(session: AsyncSession, device_ids: list[int]) -> dict[int, str]:
    if not device_ids:
        return {}
    latest = (
        select(TrackerPosition.tracker_device_id, func.max(TrackerPosition.position_at).label("at"))
        .where(TrackerPosition.tracker_device_id.in_(device_ids),
               TrackerPosition.source == PositionSource.IRIDIUM)
        .group_by(TrackerPosition.tracker_device_id)
        .subquery()
    )
    rows = await session.execute(
        select(TrackerPosition.tracker_device_id, TrackerPosition.external_point_id)
        .join(latest, (TrackerPosition.tracker_device_id == latest.c.tracker_device_id)
              & (TrackerPosition.position_at == latest.c.at))
    )
    return {device_id: point_id for device_id, point_id in rows if point_id}


async def _save_points(session: AsyncSession, known: dict[str, TrackerDevice],
                       points: dict[str, list[IridiumPoint]], report: PollReport) -> None:
    all_points = [p for ps in points.values() for p in ps]
    report.points_received = len({(imei, p.at) for imei, ps in points.items() for p in ps})
    if not all_points:
        return

    device_ids = [known[imei].id for imei in points]
    earliest = min(p.at for p in all_points)
    latest = max(p.at for p in all_points)
    assignments = list((await session.execute(
        select(TrackerAssignment)
        .where(TrackerAssignment.tracker_device_id.in_(device_ids),
               TrackerAssignment.valid_from <= latest,
               or_(TrackerAssignment.valid_to.is_(None), TrackerAssignment.valid_to > earliest))
        .options(selectinload(TrackerAssignment.race_participant))
    )).scalars())

    race_ids = {a.race_participant.race_id for a in assignments}
    stages = list((await session.execute(
        select(Stage).where(Stage.race_id.in_(race_ids or [0]), Stage.start_at.is_not(None))
        .order_by(Stage.start_at)
    )).scalars())

    rows, seen = [], set()
    for imei, device_points in points.items():
        device_id = known[imei].id
        for point in device_points:
            if (device_id, point.at) in seen:
                continue
            seen.add((device_id, point.at))
            assignment = _assignment_at(assignments, device_id, point.at)
            if assignment is None:
                report.points_unassigned += 1
                continue
            rows.append({
                "tracker_device_id": device_id,
                "race_participant_id": assignment.race_participant_id,
                "stage_id": assignment.stage_id or _stage_at(
                    stages, assignment.race_participant.race_id, point.at),
                "external_point_id": point.id,
                "position_at": point.at,
                "latitude": point.lat,
                "longitude": point.lon,
                "altitude_m": point.altitude,
                "course_deg": point.course,
                "device_speed_kmh": point.speed,
                "battery_percent": point.battery,
                "source": PositionSource.IRIDIUM,
            })

    if rows:
        inserted = await session.execute(
            insert(TrackerPosition).values(rows).on_conflict_do_nothing()
            .returning(TrackerPosition.id)
        )
        report.points_saved = len(inserted.all())


def _assignment_at(assignments: list[TrackerAssignment], device_id: int,
                   at: datetime) -> TrackerAssignment | None:
    """Привязка, действующая в момент точки. Привязка к этапу важнее привязки на всю гонку."""
    matching = [
        a for a in assignments
        if a.tracker_device_id == device_id and a.valid_from <= at
        and (a.valid_to is None or at < a.valid_to)
    ]
    matching.sort(key=lambda a: (a.stage_id is None, -a.valid_from.timestamp()))
    return matching[0] if matching else None


def _stage_at(stages: list[Stage], race_id: int, at: datetime) -> int | None:
    """Этап, который шёл в момент точки: последний стартовавший, ещё не закрытый."""
    current = None
    for stage in stages:
        if stage.race_id != race_id or stage.start_at > at:
            continue
        if stage.finish_at is None or at <= stage.finish_at:
            current = stage.id
    return current
