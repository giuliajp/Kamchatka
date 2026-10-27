"""
Общий зачёт гонки по дисциплинам — ТОЛЬКО из опубликованных судейских протоколов.

Правила заказчика:
- Места — внутри дисциплины. Общего зачёта между дисциплинами нет.
- Итог — сумма времён этапов из протокола.
- Штрафы относятся к участию в гонке целиком (не к этапу): показываются списком и суммой.
- Участник DNF/DNS НИКОГДА не исчезает: он стоит в конце списка без места,
  а на непройденных этапах у него пусто (фронтенд показывает «—»).
- GPS и отметки на КП здесь не используются.
- Если судья указал место в протоколе — берём его (судейская версия важнее расчёта).

ОТКРЫТЫЙ ВОПРОС к заказчику (см. docs/backend-plan.md):
в протоколе 2026 итог = сумма этапов, штраф сверху НЕ прибавлен
(Шевчук: 18:25:10 при штрафе 2 мин). Значит, штраф уже внутри времени этапа.
Если заказчик скажет «прибавлять сверху» — поменять одну константу ниже на False.
"""

from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Discipline, Penalty, Protocol, ProtocolStatus, RaceParticipant, RaceParticipantStatus,
    Stage, StageResult, StageResultStatus,
)

# True  — штраф уже учтён во времени этапа (так в протоколе 2026), к итогу не прибавляем.
# False — прибавлять сумму штрафов к сумме этапов.
PENALTY_INCLUDED_IN_STAGE_TIMES = True

# Статусы участия, при которых место не присваивается.
NO_PLACE_STATUSES = {RaceParticipantStatus.DSQ, RaceParticipantStatus.OUT_OF_COMPETITION}


def format_duration(seconds: int | None) -> str | None:
    """12345 → «03:25:45». Часы могут быть больше 24 («29:07:47»)."""
    if seconds is None:
        return None
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


@dataclass
class StandingRow:
    entry: RaceParticipant
    cells: dict[int, StageResult | None]          # номер этапа → строка протокола или None
    penalties: list[Penalty]
    place: int | None = None
    total_seconds: int | None = None
    status: str = "registered"
    stages_finished: int = 0
    finished_seconds: int = 0                     # сумма пройденных этапов (для сортировки)
    gap_to_leader_seconds: int | None = None


@dataclass
class DisciplineStanding:
    discipline: Discipline
    stages: list[Stage]                           # этапы, по которым есть опубликованный протокол
    protocols: dict[int, Protocol]                # номер этапа → протокол
    rows: list[StandingRow] = field(default_factory=list)


async def load_race_entries(session: AsyncSession, race_id: int) -> list[RaceParticipant]:
    result = await session.execute(
        select(RaceParticipant)
        .where(RaceParticipant.race_id == race_id)
        .options(
            selectinload(RaceParticipant.participant),
            selectinload(RaceParticipant.discipline),
            selectinload(RaceParticipant.penalties),
        )
        .order_by(RaceParticipant.start_number)
    )
    return list(result.scalars())


async def build_standings(
    session: AsyncSession,
    race_id: int,
    up_to_stage: int | None = None,
    discipline_code: str | None = None,
) -> list[DisciplineStanding]:
    """Зачёт по каждой дисциплине гонки. up_to_stage — «после этапа N» (для протокола этапа)."""
    entries = await load_race_entries(session, race_id)
    if discipline_code:
        entries = [e for e in entries if e.discipline.code == discipline_code]

    stages_q = select(Stage).where(Stage.race_id == race_id).order_by(Stage.number)
    if up_to_stage is not None:
        stages_q = stages_q.where(Stage.number <= up_to_stage)
    stages = list((await session.execute(stages_q)).scalars())
    stage_by_id = {s.id: s for s in stages}

    protocols: list[Protocol] = []
    if stages:
        protocols = list((await session.execute(
            select(Protocol)
            .where(Protocol.stage_id.in_(stage_by_id), Protocol.published_at.is_not(None))
            .options(selectinload(Protocol.results))
        )).scalars())

    # дисциплина → номер этапа → протокол
    by_discipline: dict[int, dict[int, Protocol]] = defaultdict(dict)
    for protocol in protocols:
        by_discipline[protocol.discipline_id][stage_by_id[protocol.stage_id].number] = protocol

    disciplines: dict[int, Discipline] = {}
    entries_by_discipline: dict[int, list[RaceParticipant]] = defaultdict(list)
    for entry in entries:
        disciplines[entry.discipline_id] = entry.discipline
        entries_by_discipline[entry.discipline_id].append(entry)

    standings = []
    for discipline in sorted(disciplines.values(), key=lambda d: (d.sort_order, d.id)):
        stage_protocols = by_discipline.get(discipline.id, {})
        counted = [s for s in stages if s.number in stage_protocols]
        standing = DisciplineStanding(discipline, counted, stage_protocols)
        for entry in entries_by_discipline[discipline.id]:
            cells = {}
            for stage in counted:
                found = [r for r in stage_protocols[stage.number].results
                         if r.race_participant_id == entry.id]
                cells[stage.number] = found[0] if found else None
            standing.rows.append(StandingRow(entry, cells, list(entry.penalties)))
        _rank(standing)
        standings.append(standing)
    return standings


def _rank(standing: DisciplineStanding) -> None:
    complete: list[StandingRow] = []
    incomplete: list[StandingRow] = []

    for row in standing.rows:
        penalty_sum = sum(p.seconds for p in row.penalties)
        finished = [c for c in row.cells.values()
                    if c is not None and c.status == StageResultStatus.FINISHED]
        row.stages_finished = len(finished)
        row.finished_seconds = sum(c.final_time_seconds or 0 for c in finished)

        if not standing.stages:
            row.status = row.entry.status.value
            incomplete.append(row)
            continue

        all_finished = row.stages_finished == len(standing.stages)
        if all_finished and row.entry.status not in NO_PLACE_STATUSES:
            row.total_seconds = row.finished_seconds
            if not PENALTY_INCLUDED_IN_STAGE_TIMES:
                row.total_seconds += penalty_sum
            row.status = "finished" if row.entry.status == RaceParticipantStatus.FINISHED else "active"
            complete.append(row)
        else:
            row.status = _first_problem(row)
            incomplete.append(row)

    complete.sort(key=lambda r: (r.total_seconds, r.entry.start_number))
    previous_time, previous_place = None, 0
    for index, row in enumerate(complete, start=1):
        if row.total_seconds != previous_time:
            previous_place, previous_time = index, row.total_seconds
        row.place = previous_place
        # Судейская версия важнее расчёта: место из протокола последнего этапа.
        last = row.cells.get(standing.stages[-1].number)
        if last is not None and last.place is not None:
            row.place = last.place
    complete.sort(key=lambda r: (r.place, r.total_seconds, r.entry.start_number))

    if complete:
        leader = complete[0].total_seconds
        for row in complete:
            row.gap_to_leader_seconds = row.total_seconds - leader

    # Без места: больше пройденных этапов — выше, затем по времени, затем по номеру.
    incomplete.sort(key=lambda r: (-r.stages_finished, r.finished_seconds, r.entry.start_number))
    standing.rows = complete + incomplete


def _first_problem(row: StandingRow) -> str:
    if row.entry.status in NO_PLACE_STATUSES:
        return row.entry.status.value
    for cell in row.cells.values():
        if cell is None:
            return "dns"
        if cell.status != StageResultStatus.FINISHED:
            return cell.status.value
    return row.entry.status.value


def protocol_is_final(protocol: Protocol | None) -> bool:
    return protocol is not None and protocol.status == ProtocolStatus.FINAL
