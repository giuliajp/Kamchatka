"""
Админка во время гонки (задача 3.6): мониторинг трекеров, отметки судей на КП, SOS,
статистика болельщиков. Подключено в app/main.py с префиксом /api. Только для организаторов.

Правила брифа:
- SOS показывается ТОЛЬКО здесь, в публичное API не попадает.
- Просрочка = нет точек дольше порога этапа (stale_after_minutes, по умолчанию 45 мин).
  Это состояние устройства, а не участника: статус каюра не меняется.
- Официальное время — отметка судьи. Трекер для времени КП не используется.
- Каждая правка отметки пишется в журнал: кто, когда, что было, что стало.
"""

import csv
import io
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import AdminDep, SessionDep
from app.api.presenters import discipline_short, stage_short
from app.models import (
    ChangeAction, CheckpointPass, CheckpointPassLog, Race, RaceParticipant, Stage,
    StageCheckpoint, StageStatus, TrackerAlert, TrackerAssignment,
)
from app.models.base import utcnow
from app.schemas.admin import (
    AlertAcknowledgeIn, AlertOut, CheckpointPassIn, CheckpointPassLogOut, CheckpointPassOut,
    CheckpointPassPatch, StageMonitoring,
)
from app.schemas.common import ApiResponse, ok
from app.services.positions import last_two_points
from app.services.support import counts_at

router = APIRouter(prefix="/admin", tags=["Админка: гонка"])

KAMCHATKA = timezone(timedelta(hours=12))
FUTURE_TOLERANCE = timedelta(minutes=10)   # часы у судьи могут немного спешить


# ── Упаковка ───────────────────────────────────────────────────────────

def pass_out(p: CheckpointPass) -> dict:
    return {"id": p.id, "race_participant_id": p.race_participant_id,
            "stage_checkpoint_id": p.stage_checkpoint_id, "arrived_at": p.arrived_at,
            "departed_at": p.departed_at, "entered_by": p.entered_by, "note": p.note,
            "updated_at": p.updated_at}


def pass_snapshot(p: CheckpointPass) -> dict:
    return {"arrived_at": p.arrived_at.isoformat(),
            "departed_at": p.departed_at.isoformat() if p.departed_at else None,
            "note": p.note}


def alert_out(a: TrackerAlert) -> dict:
    entry = a.race_participant
    return {"id": a.id, "race_participant_id": a.race_participant_id,
            "start_number": entry.start_number if entry else None,
            "full_name": entry.participant.full_name if entry else None,
            "imei": a.tracker_device.imei, "type": a.type.value, "occurred_at": a.occurred_at,
            "latitude": a.latitude, "longitude": a.longitude,
            "acknowledged_at": a.acknowledged_at, "acknowledged_by": a.acknowledged_by,
            "note": a.note}


def alerts_query():
    return select(TrackerAlert).options(
        selectinload(TrackerAlert.tracker_device),
        selectinload(TrackerAlert.race_participant).selectinload(RaceParticipant.participant),
    )


# ── Мониторинг ─────────────────────────────────────────────────────────

@router.get("/stages/{stage_id}/monitoring", response_model=ApiResponse[StageMonitoring],
            summary="Мониторинг трекеров на этапе: последняя точка, просрочка, SOS, отметки КП")
async def stage_monitoring(stage_id: int, session: SessionDep, admin: AdminDep):
    stage = (await session.execute(
        select(Stage).where(Stage.id == stage_id).options(
            selectinload(Stage.race),
            selectinload(Stage.stage_checkpoints).selectinload(StageCheckpoint.checkpoint),
        )
    )).scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Этап не найден")
    now = utcnow()
    stale = stage.effective_stale_after_minutes

    entries = (await session.execute(
        select(RaceParticipant).where(RaceParticipant.race_id == stage.race_id)
        .options(selectinload(RaceParticipant.participant), selectinload(RaceParticipant.discipline))
        .order_by(RaceParticipant.start_number)
    )).scalars().all()
    ids = [e.id for e in entries] or [0]

    assignments = (await session.execute(
        select(TrackerAssignment)
        .where(TrackerAssignment.race_participant_id.in_(ids),
               TrackerAssignment.valid_from <= now,
               or_(TrackerAssignment.valid_to.is_(None), TrackerAssignment.valid_to > now),
               or_(TrackerAssignment.stage_id.is_(None), TrackerAssignment.stage_id == stage.id))
        .options(selectinload(TrackerAssignment.tracker_device))
        .order_by(TrackerAssignment.valid_from)
    )).scalars().all()
    tracker = {a.race_participant_id: a.tracker_device for a in assignments}  # последняя побеждает

    points = await last_two_points(session, stage.id)
    alerts: dict[int, list[TrackerAlert]] = {}
    for a in (await session.execute(
        alerts_query().where(TrackerAlert.race_participant_id.in_(ids),
                             TrackerAlert.acknowledged_at.is_(None))
        .order_by(TrackerAlert.occurred_at.desc())
    )).scalars():
        alerts.setdefault(a.race_participant_id, []).append(a)
    checkpoint_ids = [sc.id for sc in stage.stage_checkpoints] or [0]
    passes: dict[int, list[CheckpointPass]] = {}
    for p in (await session.execute(
        select(CheckpointPass).where(CheckpointPass.stage_checkpoint_id.in_(checkpoint_ids))
        .order_by(CheckpointPass.arrived_at)
    )).scalars():
        passes.setdefault(p.race_participant_id, []).append(p)

    rows = []
    for e in entries:
        last = (points.get(e.id) or [None])[0]
        reference = last.position_at if last else stage.start_at
        overdue = (stage.status == StageStatus.LIVE and e.id in tracker and reference is not None
                   and now - reference > timedelta(minutes=stale))
        device = tracker.get(e.id)
        rows.append({
            "race_participant_id": e.id, "start_number": e.start_number,
            "full_name": e.participant.full_name, "discipline": discipline_short(e.discipline),
            "status": e.status.value,
            "tracker": {"imei": device.imei, "name": device.name} if device else None,
            "last_position": {"position_at": last.position_at, "latitude": last.latitude,
                              "longitude": last.longitude, "battery_percent": last.battery_percent}
            if last else None,
            "minutes_since_last": int((now - last.position_at).total_seconds() // 60) if last else None,
            "is_overdue": overdue,
            "active_alerts": [alert_out(a) for a in alerts.get(e.id, [])],
            "passes": [pass_out(p) for p in passes.get(e.id, [])],
        })
    rows.sort(key=lambda r: (not r["active_alerts"], not r["is_overdue"], r["start_number"]))

    sos = sum(1 for r in rows if r["active_alerts"])
    overdue = sum(1 for r in rows if r["is_overdue"])
    no_tracker = sum(1 for r in rows if r["tracker"] is None)
    healthy = sum(1 for r in rows if r["tracker"] and not r["active_alerts"] and not r["is_overdue"])
    return ok({
        "stage": stage_short(stage), "race_id": stage.race_id, "generated_at": now,
        "tracking_interval_minutes": stage.effective_interval_minutes,
        "stale_after_minutes": stale,
        "checkpoints": [{"stage_checkpoint_id": sc.id, "order_index": sc.order_index,
                         "role": sc.role.value, "label": sc.label, "name": sc.checkpoint.name}
                        for sc in stage.stage_checkpoints],
        "summary": {"total": len(rows), "sos": sos, "overdue": overdue,
                    "no_tracker": no_tracker, "ok": healthy},
        "rows": rows,
    })


# ── Отметки судей на КП ────────────────────────────────────────────────

def check_times(arrived: datetime, departed: datetime | None) -> None:
    if arrived > utcnow() + FUTURE_TOLERANCE:
        raise HTTPException(status_code=422, detail="Время отметки ещё не наступило")
    if departed is not None and departed < arrived:
        raise HTTPException(status_code=422, detail="Время ухода раньше времени прихода")


async def get_pass_or_404(session, pass_id: int) -> CheckpointPass:
    item = await session.get(CheckpointPass, pass_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Отметка не найдена")
    return item


@router.post("/checkpoint-passes", response_model=ApiResponse[CheckpointPassOut], status_code=201,
             summary="Внести отметку судьи на КП")
async def create_pass(body: CheckpointPassIn, session: SessionDep, admin: AdminDep):
    entry = await session.get(RaceParticipant, body.race_participant_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Участник гонки не найден")
    checkpoint = (await session.execute(
        select(StageCheckpoint).where(StageCheckpoint.id == body.stage_checkpoint_id)
        .options(selectinload(StageCheckpoint.stage))
    )).scalar_one_or_none()
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="КП этапа не найден")
    if checkpoint.stage.race_id != entry.race_id:
        raise HTTPException(status_code=422, detail="КП относится к другой гонке")
    check_times(body.arrived_at, body.departed_at)

    item = CheckpointPass(race_participant_id=entry.id, stage_checkpoint_id=checkpoint.id,
                          arrived_at=body.arrived_at, departed_at=body.departed_at,
                          note=body.note, entered_by=admin.full_name)
    session.add(item)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Отметка на этом КП уже есть — измените её")
    session.add(CheckpointPassLog(
        checkpoint_pass_id=item.id, race_participant_id=entry.id, stage_checkpoint_id=checkpoint.id,
        action=ChangeAction.CREATE, before=None, after=pass_snapshot(item), changed_by=admin.full_name))
    await session.commit()
    return ok(pass_out(item))


@router.patch("/checkpoint-passes/{pass_id}", response_model=ApiResponse[CheckpointPassOut],
              summary="Исправить отметку (с записью в журнал)")
async def update_pass(pass_id: int, body: CheckpointPassPatch, session: SessionDep, admin: AdminDep):
    item = await get_pass_or_404(session, pass_id)
    before = pass_snapshot(item)
    changes = body.model_dump(exclude_unset=True)
    if "arrived_at" in changes and changes["arrived_at"] is None:
        raise HTTPException(status_code=422, detail="Время прихода обязательно")
    for field, value in changes.items():
        setattr(item, field, value)
    check_times(item.arrived_at, item.departed_at)
    item.entered_by = admin.full_name
    after = pass_snapshot(item)
    if after != before:
        session.add(CheckpointPassLog(
            checkpoint_pass_id=item.id, race_participant_id=item.race_participant_id,
            stage_checkpoint_id=item.stage_checkpoint_id, action=ChangeAction.UPDATE,
            before=before, after=after, changed_by=admin.full_name))
    await session.commit()
    await session.refresh(item)
    return ok(pass_out(item))


@router.delete("/checkpoint-passes/{pass_id}", response_model=ApiResponse[CheckpointPassOut],
               summary="Удалить ошибочную отметку (с записью в журнал)")
async def delete_pass(pass_id: int, session: SessionDep, admin: AdminDep):
    item = await get_pass_or_404(session, pass_id)
    result = pass_out(item)
    session.add(CheckpointPassLog(
        checkpoint_pass_id=None, race_participant_id=item.race_participant_id,
        stage_checkpoint_id=item.stage_checkpoint_id, action=ChangeAction.DELETE,
        before=pass_snapshot(item), after=None, changed_by=admin.full_name))
    await session.delete(item)
    await session.commit()
    return ok(result)


@router.get("/stages/{stage_id}/checkpoint-passes/log",
            response_model=ApiResponse[list[CheckpointPassLogOut]],
            summary="Журнал правок отметок на этапе (новые сверху)")
async def pass_log(stage_id: int, session: SessionDep, admin: AdminDep):
    items = (await session.execute(
        select(CheckpointPassLog)
        .join(StageCheckpoint, StageCheckpoint.id == CheckpointPassLog.stage_checkpoint_id)
        .where(StageCheckpoint.stage_id == stage_id)
        .order_by(CheckpointPassLog.changed_at.desc(), CheckpointPassLog.id.desc())
    )).scalars()
    return ok([{"id": i.id, "checkpoint_pass_id": i.checkpoint_pass_id,
                "race_participant_id": i.race_participant_id,
                "stage_checkpoint_id": i.stage_checkpoint_id, "action": i.action.value,
                "before": i.before, "after": i.after, "changed_by": i.changed_by,
                "changed_at": i.changed_at} for i in items])


# ── SOS ────────────────────────────────────────────────────────────────

@router.get("/races/{race_id}/alerts", response_model=ApiResponse[list[AlertOut]],
            summary="Тревожные сигналы гонки (по умолчанию — только активные)")
async def list_alerts(race_id: int, session: SessionDep, admin: AdminDep,
                      active: bool = Query(True, description="true — только не закрытые")):
    stmt = alerts_query().join(
        RaceParticipant, RaceParticipant.id == TrackerAlert.race_participant_id
    ).where(RaceParticipant.race_id == race_id).order_by(TrackerAlert.occurred_at.desc())
    if active:
        stmt = stmt.where(TrackerAlert.acknowledged_at.is_(None))
    return ok([alert_out(a) for a in (await session.execute(stmt)).scalars()])


@router.post("/alerts/{alert_id}/acknowledge", response_model=ApiResponse[AlertOut],
             summary="Закрыть SOS: ложный или урегулирован (причина обязательна)")
async def acknowledge_alert(alert_id: int, body: AlertAcknowledgeIn, session: SessionDep,
                            admin: AdminDep):
    alert = (await session.execute(alerts_query().where(TrackerAlert.id == alert_id))).scalar_one_or_none()
    if alert is None:
        raise HTTPException(status_code=404, detail="Сигнал не найден")
    if alert.acknowledged_at is not None:
        raise HTTPException(status_code=409, detail="Сигнал уже закрыт")
    alert.acknowledged_at = utcnow()
    alert.acknowledged_by = admin.full_name
    alert.note = body.note.strip()
    await session.commit()
    return ok(alert_out(alert))


# ── Статистика болельщиков ─────────────────────────────────────────────

@router.get("/races/{race_id}/support-stats.csv", response_class=Response,
            summary="Болельщики по участникам и дням (CSV для Excel)")
async def support_stats_csv(race_id: int, session: SessionDep, admin: AdminDep,
                            days: int = Query(14, ge=1, le=90)):
    if await session.get(Race, race_id) is None:
        raise HTTPException(status_code=404, detail="Гонка не найдена")
    entries = (await session.execute(
        select(RaceParticipant).where(RaceParticipant.race_id == race_id)
        .options(selectinload(RaceParticipant.participant), selectinload(RaceParticipant.discipline))
        .order_by(RaceParticipant.start_number)
    )).scalars().all()
    today = utcnow().astimezone(KAMCHATKA).date()
    day_list = [today - timedelta(days=n) for n in range(days - 1, -1, -1)]
    # Значение дня — на конец дня по Камчатке; для сегодняшнего — на текущий момент.
    columns = []
    for day in day_list:
        moment = min(datetime.combine(day + timedelta(days=1), time(), KAMCHATKA), utcnow())
        columns.append(await counts_at(session, moment, race_id=race_id))

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")   # «;» — так русский Excel открывает без настройки
    writer.writerow(["Номер", "Участник", "Дисциплина", *[d.strftime("%d.%m.%Y") for d in day_list]])
    for e in entries:
        writer.writerow([e.start_number, e.participant.full_name, e.discipline.name,
                         *[c.get(e.id, 0) for c in columns]])
    # BOM в начале — чтобы Excel правильно показал кириллицу.
    return Response(content="\ufeff" + buffer.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="supporters-{race_id}.csv"'})
