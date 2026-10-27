"""
Схемы ответов публичного API: гонки, этапы, участники, результаты.

Длительности — в секундах (*_seconds) и строкой «ЧЧ:ММ:СС» (*_time) для показа.
null во времени этапа — фронтенд показывает «—».
Даты и время — UTC, ISO 8601.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


# ── Справочные куски ───────────────────────────────────────────────────

class DisciplineShort(BaseModel):
    id: int
    code: str
    name: str


class RaceShort(BaseModel):
    id: int
    name: str
    year: int
    status: str            # upcoming / live / finished
    is_current: bool
    start_date: date | None
    end_date: date | None
    location: str | None


class StageShort(BaseModel):
    id: int
    number: int
    name: str | None
    distance_km: float | None
    start_at: datetime | None
    finish_at: datetime | None
    status: str            # planned / live / finished / cancelled


class RaceDiscipline(DisciplineShort):
    participants_count: int


class RaceDetail(RaceShort):
    disciplines: list[RaceDiscipline]
    stages: list[StageShort]


# ── Маршрут этапа ──────────────────────────────────────────────────────

class StageCheckpointOut(BaseModel):
    id: int
    order_index: int
    role: str              # start / checkpoint / finish
    label: str | None      # «КП-3»
    name: str
    latitude: float
    longitude: float
    elevation_m: float | None
    km_from_start: float | None
    required_rest_minutes: int
    segment_description: str | None


class ElevationPoint(BaseModel):
    km: float
    elevation_m: float


class StageDetail(StageShort):
    race_id: int
    description: str | None
    checkpoints: list[StageCheckpointOut]
    route_geojson: dict[str, Any] | None
    route_updated_at: datetime | None
    elevation_profile: list[ElevationPoint]   # пусто, если в треке нет высот


# ── Участники ──────────────────────────────────────────────────────────

class ParticipantListItem(BaseModel):
    race_participant_id: int
    participant_id: int
    start_number: int
    full_name: str
    last_name: str
    first_name: str
    photo_url: str | None
    region: str | None
    discipline: DisciplineShort
    dogs_count: int | None
    status: str
    place: int | None                  # место в дисциплине по опубликованным протоколам
    total_time_seconds: int | None
    total_time: str | None


class ParticipantRaceEntry(BaseModel):
    race: RaceShort
    race_participant_id: int
    start_number: int
    region: str | None
    discipline: DisciplineShort
    dogs_count: int | None
    status: str
    place: int | None
    total_time_seconds: int | None
    total_time: str | None
    gap_to_leader_seconds: int | None
    penalty_total_seconds: int


class ParticipantDetail(BaseModel):
    id: int
    full_name: str
    last_name: str
    first_name: str
    middle_name: str | None
    photo_url: str | None
    bio: str | None
    races: list[ParticipantRaceEntry]   # сначала самые новые


# ── Результаты ─────────────────────────────────────────────────────────

class PenaltyOut(BaseModel):
    seconds: int
    time: str
    reason: str | None
    rule_reference: str | None


class StageCell(BaseModel):
    stage_number: int
    status: str | None                  # finished / dnf / dns / dsq; null — строки нет («—»)
    time_seconds: int | None
    time: str | None
    dogs_at_start: int | None
    dogs_at_finish: int | None
    is_corrected_after_final: bool
    note: str | None


class StandingRowOut(BaseModel):
    race_participant_id: int
    participant_id: int
    place: int | None
    start_number: int
    full_name: str
    last_name: str
    first_name: str
    region: str | None
    discipline_code: str
    status: str                         # finished / active / dnf / dns / dsq ...
    stages: list[StageCell]
    total_time_seconds: int | None
    total_time: str | None
    gap_to_leader_seconds: int | None
    gap_to_leader: str | None
    penalties: list[PenaltyOut]
    penalty_total_seconds: int
    penalty_total: str | None


class ResultStageInfo(BaseModel):
    id: int
    number: int
    name: str | None
    distance_km: float | None
    protocol_status: str               # preliminary / final
    is_final: bool


class DisciplineResults(BaseModel):
    discipline: DisciplineShort
    stages: list[ResultStageInfo]
    rows: list[StandingRowOut]


class RaceResults(BaseModel):
    race: RaceShort
    up_to_stage: int | None
    penalty_included_in_stage_times: bool
    disciplines: list[DisciplineResults]


class StageProtocolOut(BaseModel):
    discipline: DisciplineShort
    status: str
    is_final: bool
    published_at: datetime | None
    finalized_at: datetime | None
    weather: str | None
    chief_judge: str | None
    chief_secretary: str | None
    rows: list[StandingRowOut]          # зачёт после этого этапа


class StageProtocols(BaseModel):
    stage: StageShort
    race_id: int
    protocols: list[StageProtocolOut]
