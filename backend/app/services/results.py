"""
Общая логика правки официальных результатов (задачи 3.3 и 3.4).

- Время вводится как в протоколе судей: «ЧЧ:ММ:СС» (часы могут быть больше 24).
- Любое изменение строки протокола или штрафа пишется в ResultChangeLog по полю: было → стало.
- Окончательный протокол правится только особой процедурой: основание + кто утвердил,
  строка получает видимую пометку is_corrected_after_final.
- Статус участия в гонке (DNF, завершил) пересчитывается из строк протоколов.
"""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ChangeAction, Protocol, RaceParticipant, RaceParticipantStatus, ResultChangeLog, Stage,
    StageResult, StageResultStatus,
)

LOGGED_FIELDS = ("status", "final_time_seconds", "dogs_at_start", "dogs_at_finish", "place", "note")
_DURATION = re.compile(r"^(\d{1,3}):([0-5]\d):([0-5]\d)$")
_EMPTY = {"", "-", "—", "#ЗНАЧ!", "#ДЕЛ/0!", "#VALUE!", "#DIV/0!", "00:00:00", "0:00:00"}


class ResultError(ValueError):
    """Ошибка данных, понятная организатору (уходит в ответ как 422)."""


def parse_duration(text: str) -> int:
    match = _DURATION.match(text.strip())
    if not match:
        raise ResultError(f"Время «{text}» — ожидается ЧЧ:ММ:СС")
    hours, minutes, seconds = map(int, match.groups())
    total = hours * 3600 + minutes * 60 + seconds
    if total <= 0:
        raise ResultError("Время должно быть больше нуля")
    return total


def parse_result_cell(text: str | None) -> tuple[StageResultStatus, int | None] | None:
    """Ячейка «Результат»: время, DNF/DNS/DSQ или пусто (None — нет данных)."""
    value = (text or "").strip()
    if value.upper() in _EMPTY:
        return None
    if value.upper() in ("DNF", "DNS", "DSQ"):
        return StageResultStatus(value.lower()), None
    return StageResultStatus.FINISHED, parse_duration(value)


def check_result_fields(fields: dict[str, Any]) -> None:
    status, time = fields.get("status"), fields.get("final_time_seconds")
    if status == StageResultStatus.FINISHED and not time:
        raise ResultError("У финишировавшего нужно время")
    if status != StageResultStatus.FINISHED and time is not None:
        raise ResultError("Время указывается только у финишировавших")
    start, finish = fields.get("dogs_at_start"), fields.get("dogs_at_finish")
    for value in (start, finish, fields.get("place")):
        if value is not None and value <= 0:
            raise ResultError("Число собак и место — больше нуля")
    if start is not None and finish is not None and finish > start:
        raise ResultError("Собак на финише не может быть больше, чем на старте")


def _text(value: Any) -> str | None:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


def apply_result_change(
    session: AsyncSession, result: StageResult, new: dict[str, Any], *, changed_by: str,
    reason: str | None, post_final: bool = False, approved_by: str | None = None,
) -> int:
    """Применить новые значения к строке протокола и записать журнал. Возвращает число правок."""
    merged = {field: getattr(result, field) for field in LOGGED_FIELDS}
    merged.update(new)
    check_result_fields(merged)
    changes = 0
    for field in LOGGED_FIELDS:
        if field not in new or getattr(result, field) == new[field]:
            continue
        session.add(ResultChangeLog(
            protocol_id=result.protocol_id, entity="stage_result", entity_id=result.id,
            race_participant_id=result.race_participant_id, action=ChangeAction.UPDATE,
            field=field, old_value=_text(getattr(result, field)), new_value=_text(new[field]),
            changed_by=changed_by, reason=reason, is_post_final=post_final, approved_by=approved_by,
        ))
        setattr(result, field, new[field])
        changes += 1
    if changes:
        result.net_time_seconds = result.final_time_seconds
        if post_final:
            result.is_corrected_after_final = True
    return changes


def log_created_result(session: AsyncSession, result: StageResult, *, changed_by: str,
                       reason: str | None) -> None:
    session.add(ResultChangeLog(
        protocol_id=result.protocol_id, entity="stage_result", entity_id=result.id,
        race_participant_id=result.race_participant_id, action=ChangeAction.CREATE,
        new_value=f"{_text(result.status)} {result.final_time_seconds or ''}".strip(),
        changed_by=changed_by, reason=reason,
    ))


async def refresh_entry_status(session: AsyncSession, entry: RaceParticipant) -> None:
    """Статус участия по строкам протоколов всех этапов гонки (черновики тоже считаются)."""
    if entry.status == RaceParticipantStatus.OUT_OF_COMPETITION:
        return
    statuses = list(await session.scalars(
        select(StageResult.status).where(StageResult.race_participant_id == entry.id)
    ))
    stages_total = await session.scalar(
        select(func.count()).select_from(Stage).where(Stage.race_id == entry.race_id)
    )
    if StageResultStatus.DSQ in statuses:
        entry.status = RaceParticipantStatus.DSQ
    elif StageResultStatus.DNF in statuses or StageResultStatus.DNS in statuses:
        entry.status = RaceParticipantStatus.DNF
    elif statuses and len(statuses) >= (stages_total or 0) \
            and all(s == StageResultStatus.FINISHED for s in statuses):
        entry.status = RaceParticipantStatus.FINISHED
    elif statuses:
        entry.status = RaceParticipantStatus.ACTIVE
    elif entry.status != RaceParticipantStatus.DSQ:
        entry.status = RaceParticipantStatus.REGISTERED


async def get_or_create_protocol(session: AsyncSession, stage: Stage, discipline_id: int) -> tuple[Protocol, bool]:
    protocol = await session.scalar(select(Protocol).where(
        Protocol.stage_id == stage.id, Protocol.discipline_id == discipline_id))
    if protocol is not None:
        return protocol, False
    protocol = Protocol(stage_id=stage.id, discipline_id=discipline_id)
    session.add(protocol)
    await session.flush()
    return protocol, True
