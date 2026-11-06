"""
Админка: официальные результаты (задачи 3.3 и 3.4). Только для организаторов.

- Загрузка протокола из CSV (лист Excel судей) — с проверкой без сохранения (dry_run).
- Просмотр и правка строк протокола, штрафы за гонку — каждая правка в журнал.
- Публикация протокола (появляется в приложении, уходят push) и утверждение (окончательный).
- Исправление окончательного протокола — особой процедурой: основание + кто утвердил,
  в приложении у строки видна пометка «исправлено после утверждения».
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminDep, SessionDep
from app.api.presenters import discipline_short, stage_short
from app.models import (
    ChangeAction, Penalty, Protocol, ProtocolStatus, Race, RaceParticipant, ResultChangeLog, Stage,
    StageResult, StageResultStatus,
)
from app.models.base import utcnow
from app.schemas.common import ApiResponse, ok
from app.services import push
from app.services.csv_protocol import CsvImportError, import_csv
from app.services.results import (
    ResultError, apply_result_change, check_result_fields, log_created_result, parse_duration,
    refresh_entry_status,
)
from app.services.standings import build_standings, format_duration

router = APIRouter(prefix="/admin", tags=["Админка: результаты"])


# ── Схемы запросов ─────────────────────────────────────────────────────

class ResultFields(BaseModel):
    status: StageResultStatus | None = None
    time: str | None = Field(None, description="ЧЧ:ММ:СС; только у финишировавших", examples=["04:36:30"])
    dogs_at_start: int | None = Field(None, gt=0)
    dogs_at_finish: int | None = Field(None, gt=0)
    place: int | None = Field(None, gt=0, description="Место в дисциплине после этапа (как у судей)")
    note: str | None = Field(None, max_length=2000)


class ResultCreate(ResultFields):
    race_participant_id: int
    status: StageResultStatus
    reason: str | None = Field(None, max_length=2000)


class ResultPatch(ResultFields):
    reason: str | None = Field(None, max_length=2000, description="Причина правки — для журнала")


class PostFinalCorrection(ResultFields):
    reason: str = Field(min_length=3, max_length=2000, description="Основание исправления")
    approved_by: str = Field(min_length=3, max_length=200, description="Кто утвердил, например главный судья")


class ProtocolPatch(BaseModel):
    weather: str | None = None
    chief_judge: str | None = Field(None, max_length=200)
    chief_secretary: str | None = Field(None, max_length=200)


class PenaltyCreate(BaseModel):
    time: str | None = Field(None, description="Штрафное время ЧЧ:ММ:СС; пусто — штраф без времени",
                             examples=["00:02:00"])
    rule_reference: str | None = Field(None, max_length=50, examples=["П.14.11.14"])
    reason: str | None = Field(None, max_length=2000, description="За что — видно в протоколе")
    change_reason: str | None = Field(None, max_length=2000, description="Для журнала")


# ── Упаковка ───────────────────────────────────────────────────────────

def result_out(r: StageResult) -> dict:
    entry = r.race_participant
    return {"id": r.id, "race_participant_id": r.race_participant_id, "start_number": entry.start_number,
            "full_name": entry.participant.full_name, "region": entry.region, "status": r.status.value,
            "time": format_duration(r.final_time_seconds), "time_seconds": r.final_time_seconds,
            "dogs_at_start": r.dogs_at_start, "dogs_at_finish": r.dogs_at_finish, "place": r.place,
            "note": r.note, "is_corrected_after_final": r.is_corrected_after_final}


def protocol_out(p: Protocol, results_count: int | None = None) -> dict:
    return {"id": p.id, "stage": stage_short(p.stage), "discipline": discipline_short(p.discipline),
            "status": p.status.value, "published_at": p.published_at, "finalized_at": p.finalized_at,
            "finalized_by": p.finalized_by, "weather": p.weather, "chief_judge": p.chief_judge,
            "chief_secretary": p.chief_secretary, "source_filename": p.source_filename,
            "results_count": results_count}


def change_out(c: ResultChangeLog) -> dict:
    return {"id": c.id, "protocol_id": c.protocol_id, "entity": c.entity, "entity_id": c.entity_id,
            "race_participant_id": c.race_participant_id, "action": c.action.value, "field": c.field,
            "old_value": c.old_value, "new_value": c.new_value, "changed_by": c.changed_by,
            "changed_at": c.changed_at, "reason": c.reason, "is_post_final": c.is_post_final,
            "approved_by": c.approved_by}


def to_fields(body: ResultFields, *, partial: bool) -> dict:
    data = body.model_dump(exclude_unset=partial, include=set(ResultFields.model_fields))
    if "time" in data:
        text = data.pop("time")
        data["final_time_seconds"] = parse_duration(text) if text else None
    elif "status" in data and data["status"] != StageResultStatus.FINISHED:
        data["final_time_seconds"] = None         # сменили на DNF — время убираем
    return data


async def load_protocol(session, protocol_id: int, *, with_results: bool = False) -> Protocol:
    options = [selectinload(Protocol.stage), selectinload(Protocol.discipline)]
    if with_results:
        options.append(selectinload(Protocol.results).selectinload(StageResult.race_participant)
                       .selectinload(RaceParticipant.participant))
    protocol = await session.scalar(select(Protocol).where(Protocol.id == protocol_id).options(*options))
    if protocol is None:
        raise HTTPException(status_code=404, detail="Протокол не найден")
    return protocol


async def load_result(session, result_id: int) -> StageResult:
    result = await session.scalar(select(StageResult).where(StageResult.id == result_id).options(
        selectinload(StageResult.protocol),
        selectinload(StageResult.race_participant).selectinload(RaceParticipant.participant)))
    if result is None:
        raise HTTPException(status_code=404, detail="Строка протокола не найдена")
    return result


def unprocessable(error: ResultError) -> HTTPException:
    return HTTPException(status_code=422, detail=str(error))


# ── Загрузка CSV ───────────────────────────────────────────────────────

@router.post("/races/{race_id}/protocol-import", summary="Загрузить протокол из CSV (лист Excel судей)")
async def protocol_import(race_id: int, session: SessionDep, admin: AdminDep,
                          file: UploadFile = File(description="CSV из Excel судей"),
                          dry_run: bool = Form(False, description="true — только проверить, не сохранять")):
    race = await session.get(Race, race_id)
    if race is None:
        raise HTTPException(status_code=404, detail="Гонка не найдена")
    content = await file.read()
    filename = (file.filename or "protocol.csv").replace("\\", "/").rsplit("/", 1)[-1][:255]
    try:
        report = await import_csv(session, race, content, filename=filename, changed_by=admin.full_name)
    except CsvImportError as error:
        await session.rollback()
        raise HTTPException(status_code=422, detail={
            "message": f"Файл не загружен: ошибок — {len(error.errors)}. Ничего не сохранено.",
            "details": error.errors})
    if dry_run:
        await session.rollback()
    else:
        await session.commit()
    return ok({**report.as_dict(), "saved": not dry_run})


# ── Протоколы ──────────────────────────────────────────────────────────

@router.get("/races/{race_id}/protocols", summary="Все протоколы гонки, включая черновики")
async def list_protocols(race_id: int, session: SessionDep, admin: AdminDep):
    protocols = (await session.scalars(
        select(Protocol).join(Stage, Stage.id == Protocol.stage_id).where(Stage.race_id == race_id)
        .options(selectinload(Protocol.stage), selectinload(Protocol.discipline),
                 selectinload(Protocol.results))
    )).all()
    protocols.sort(key=lambda p: (p.stage.number, p.discipline.sort_order, p.discipline.id))
    return ok([protocol_out(p, len(p.results)) for p in protocols])


@router.get("/protocols/{protocol_id}", summary="Протокол со всеми строками и участниками без результата")
async def get_protocol(protocol_id: int, session: SessionDep, admin: AdminDep):
    protocol = await load_protocol(session, protocol_id, with_results=True)
    rows = sorted(protocol.results, key=lambda r: (r.place is None, r.place or 0,
                                                  r.final_time_seconds is None, r.final_time_seconds or 0,
                                                  r.race_participant.start_number))
    have = {r.race_participant_id for r in protocol.results}
    missing = (await session.scalars(
        select(RaceParticipant).where(RaceParticipant.race_id == protocol.stage.race_id,
                                      RaceParticipant.discipline_id == protocol.discipline_id,
                                      RaceParticipant.id.not_in(have or {0}))
        .options(selectinload(RaceParticipant.participant)).order_by(RaceParticipant.start_number)
    )).all()
    return ok({**protocol_out(protocol, len(rows)), "results": [result_out(r) for r in rows],
               "without_result": [{"race_participant_id": e.id, "start_number": e.start_number,
                                   "full_name": e.participant.full_name} for e in missing]})


@router.patch("/protocols/{protocol_id}", summary="Шапка протокола: погода, судьи")
async def patch_protocol(protocol_id: int, body: ProtocolPatch, session: SessionDep, admin: AdminDep):
    protocol = await load_protocol(session, protocol_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(protocol, field, value)
    await session.commit()
    return ok(protocol_out(protocol))


async def leaders(session, race_id: int, discipline_code: str) -> RaceParticipant | None:
    standings = await build_standings(session, race_id, discipline_code=discipline_code)
    for standing in standings:
        if standing.rows and standing.rows[0].place == 1:
            return standing.rows[0].entry
    return None


@router.post("/protocols/{protocol_id}/publish", summary="Опубликовать: протокол появится в приложении")
async def publish_protocol(protocol_id: int, session: SessionDep, admin: AdminDep):
    protocol = await load_protocol(session, protocol_id, with_results=True)
    if protocol.published_at is not None:
        raise HTTPException(status_code=409, detail="Протокол уже опубликован")
    if not protocol.results:
        raise HTTPException(status_code=422, detail="В протоколе нет ни одной строки")
    race_id, code = protocol.stage.race_id, protocol.discipline.code
    before = await leaders(session, race_id, code)
    protocol.published_at = utcnow()
    session.add(ResultChangeLog(protocol_id=protocol.id, entity="protocol", entity_id=protocol.id,
                                action=ChangeAction.UPDATE, field="published_at",
                                new_value=protocol.published_at.isoformat(), changed_by=admin.full_name))
    await session.flush()
    after = await leaders(session, race_id, code)

    stage_title = f"Этап {protocol.stage.number}, {protocol.discipline.name}"
    for r in protocol.results:
        entry = r.race_participant
        outcome = (f"время {format_duration(r.final_time_seconds)}" if r.status == StageResultStatus.FINISHED
                   else r.status.value.upper())
        await push.send(session, segment=f"supporters:{entry.id}", trigger="protocol",
                        fragment=f"participant={entry.id}", created_by=admin.full_name,
                        message=f"{stage_title}: протокол судей опубликован. "
                                f"№{entry.start_number} {entry.participant.last_name} — {outcome}.")
    if after is not None and (before is None or before.id != after.id):
        await push.send(session, segment="all", trigger="leader", fragment="results",
                        created_by=admin.full_name,
                        message=f"{protocol.discipline.name}: после этапа {protocol.stage.number} лидирует "
                                f"№{after.start_number} {after.participant.last_name} (по протоколу судей).")
    await session.commit()
    return ok(protocol_out(protocol, len(protocol.results)))


@router.post("/protocols/{protocol_id}/finalize", summary="Утвердить: протокол становится окончательным")
async def finalize_protocol(protocol_id: int, session: SessionDep, admin: AdminDep):
    protocol = await load_protocol(session, protocol_id)
    if protocol.is_final:
        raise HTTPException(status_code=409, detail="Протокол уже утверждён")
    if protocol.published_at is None:
        raise HTTPException(status_code=422, detail="Сначала опубликуйте протокол")
    protocol.status = ProtocolStatus.FINAL
    protocol.finalized_at = utcnow()
    protocol.finalized_by = admin.full_name
    session.add(ResultChangeLog(protocol_id=protocol.id, entity="protocol", entity_id=protocol.id,
                                action=ChangeAction.UPDATE, field="status", old_value="preliminary",
                                new_value="final", changed_by=admin.full_name))
    await session.commit()
    return ok(protocol_out(protocol))


# ── Строки протокола ───────────────────────────────────────────────────

@router.post("/protocols/{protocol_id}/results", status_code=201, summary="Добавить строку в протокол")
async def create_result(protocol_id: int, body: ResultCreate, session: SessionDep, admin: AdminDep):
    protocol = await load_protocol(session, protocol_id)
    if protocol.is_final:
        raise HTTPException(status_code=409, detail="Протокол утверждён — добавлять строки нельзя")
    entry = await session.get(RaceParticipant, body.race_participant_id)
    if entry is None or entry.race_id != protocol.stage.race_id or entry.discipline_id != protocol.discipline_id:
        raise HTTPException(status_code=422, detail="Участник не из этой гонки или другой дисциплины")
    exists = await session.scalar(select(StageResult.id).where(
        StageResult.protocol_id == protocol.id, StageResult.race_participant_id == entry.id))
    if exists:
        raise HTTPException(status_code=409, detail="У участника уже есть строка в этом протоколе")
    try:
        fields = to_fields(body, partial=False)
        check_result_fields(fields)
    except ResultError as error:
        raise unprocessable(error)
    result = StageResult(protocol_id=protocol.id, race_participant_id=entry.id,
                         net_time_seconds=fields.get("final_time_seconds"), **fields)
    session.add(result)
    await session.flush()
    log_created_result(session, result, changed_by=admin.full_name, reason=body.reason)
    await refresh_entry_status(session, entry)
    await session.commit()
    return ok(result_out(await load_result(session, result.id)))


@router.patch("/stage-results/{result_id}", summary="Исправить строку предварительного протокола")
async def patch_result(result_id: int, body: ResultPatch, session: SessionDep, admin: AdminDep):
    result = await load_result(session, result_id)
    if result.protocol.is_final:
        raise HTTPException(status_code=409, detail="Протокол утверждён — используйте исправление после утверждения")
    try:
        apply_result_change(session, result, to_fields(body, partial=True),
                            changed_by=admin.full_name, reason=body.reason)
    except ResultError as error:
        raise unprocessable(error)
    await refresh_entry_status(session, result.race_participant)
    await session.commit()
    return ok(result_out(result))


@router.post("/stage-results/{result_id}/post-final-correction",
             summary="Исправить строку утверждённого протокола (основание + кто утвердил)")
async def post_final_correction(result_id: int, body: PostFinalCorrection, session: SessionDep, admin: AdminDep):
    result = await load_result(session, result_id)
    if not result.protocol.is_final:
        raise HTTPException(status_code=409, detail="Протокол не утверждён — исправьте обычной правкой")
    try:
        changes = apply_result_change(session, result, to_fields(body, partial=True),
                                      changed_by=admin.full_name, reason=body.reason,
                                      post_final=True, approved_by=body.approved_by)
    except ResultError as error:
        raise unprocessable(error)
    if not changes:
        raise HTTPException(status_code=422, detail="Новые значения совпадают с текущими")
    await refresh_entry_status(session, result.race_participant)
    await session.commit()
    return ok(result_out(result))


@router.delete("/stage-results/{result_id}", summary="Удалить ошибочную строку предварительного протокола")
async def delete_result(result_id: int, session: SessionDep, admin: AdminDep,
                        reason: str = Query(min_length=3, description="Почему удаляем — для журнала")):
    result = await load_result(session, result_id)
    if result.protocol.is_final:
        raise HTTPException(status_code=409, detail="Протокол утверждён — строки не удаляются")
    session.add(ResultChangeLog(
        protocol_id=result.protocol_id, entity="stage_result", entity_id=result.id,
        race_participant_id=result.race_participant_id, action=ChangeAction.DELETE,
        old_value=f"{result.status.value} {format_duration(result.final_time_seconds) or ''}".strip(),
        changed_by=admin.full_name, reason=reason))
    out = result_out(result)
    entry = result.race_participant
    await session.delete(result)
    await session.flush()
    await refresh_entry_status(session, entry)
    await session.commit()
    return ok(out)


# ── Штрафы за гонку ────────────────────────────────────────────────────

def penalty_out(p: Penalty) -> dict:
    return {"id": p.id, "race_participant_id": p.race_participant_id, "seconds": p.seconds,
            "time": format_duration(p.seconds), "rule_reference": p.rule_reference, "reason": p.reason}


@router.get("/race-participants/{entry_id}/penalties", summary="Штрафы участника за гонку")
async def list_penalties(entry_id: int, session: SessionDep, admin: AdminDep):
    items = await session.scalars(select(Penalty).where(Penalty.race_participant_id == entry_id).order_by(Penalty.id))
    return ok([penalty_out(p) for p in items])


@router.post("/race-participants/{entry_id}/penalties", status_code=201, summary="Добавить штраф за гонку")
async def add_penalty(entry_id: int, body: PenaltyCreate, session: SessionDep, admin: AdminDep):
    if await session.get(RaceParticipant, entry_id) is None:
        raise HTTPException(status_code=404, detail="Участник гонки не найден")
    try:
        seconds = parse_duration(body.time) if body.time and body.time.strip() not in ("0", "00:00:00") else 0
    except ResultError as error:
        raise unprocessable(error)
    penalty = Penalty(race_participant_id=entry_id, seconds=seconds, rule_reference=body.rule_reference,
                      reason=body.reason)
    session.add(penalty)
    await session.flush()
    session.add(ResultChangeLog(protocol_id=None, entity="penalty", entity_id=penalty.id,
                                race_participant_id=entry_id, action=ChangeAction.CREATE,
                                new_value=f"{body.time or 'без времени'} {body.rule_reference or ''}".strip(),
                                changed_by=admin.full_name, reason=body.change_reason))
    await session.commit()
    return ok(penalty_out(penalty))


@router.delete("/penalties/{penalty_id}", summary="Отменить штраф")
async def delete_penalty(penalty_id: int, session: SessionDep, admin: AdminDep,
                         reason: str = Query(min_length=3, description="Почему отменяем — для журнала")):
    penalty = await session.get(Penalty, penalty_id)
    if penalty is None:
        raise HTTPException(status_code=404, detail="Штраф не найден")
    session.add(ResultChangeLog(protocol_id=None, entity="penalty", entity_id=penalty.id,
                                race_participant_id=penalty.race_participant_id, action=ChangeAction.DELETE,
                                old_value=f"{format_duration(penalty.seconds)} {penalty.rule_reference or ''}".strip(),
                                changed_by=admin.full_name, reason=reason))
    out = penalty_out(penalty)
    await session.delete(penalty)
    await session.commit()
    return ok(out)


# ── Журнал правок ──────────────────────────────────────────────────────

@router.get("/protocols/{protocol_id}/changes", summary="Журнал правок протокола (новые сверху)")
async def protocol_changes(protocol_id: int, session: SessionDep, admin: AdminDep):
    items = await session.scalars(select(ResultChangeLog).where(ResultChangeLog.protocol_id == protocol_id)
                                  .order_by(ResultChangeLog.changed_at.desc(), ResultChangeLog.id.desc()))
    return ok([change_out(c) for c in items])


@router.get("/races/{race_id}/changes", summary="Журнал правок гонки: протоколы и штрафы (новые сверху)")
async def race_changes(race_id: int, session: SessionDep, admin: AdminDep,
                       limit: int = Query(200, ge=1, le=1000)):
    protocol_ids = select(Protocol.id).join(Stage, Stage.id == Protocol.stage_id).where(Stage.race_id == race_id)
    entry_ids = select(RaceParticipant.id).where(RaceParticipant.race_id == race_id)
    items = await session.scalars(
        select(ResultChangeLog)
        .where(or_(ResultChangeLog.protocol_id.in_(protocol_ids),
                   (ResultChangeLog.protocol_id.is_(None)) & ResultChangeLog.race_participant_id.in_(entry_ids)))
        .order_by(ResultChangeLog.changed_at.desc(), ResultChangeLog.id.desc()).limit(limit))
    return ok([change_out(c) for c in items])
