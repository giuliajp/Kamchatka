"""Схемы административной панели: вход, мониторинг трекеров, отметки КП, SOS."""

from datetime import datetime

from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.races import DisciplineShort, StageShort


# ── Вход ───────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class AdminOut(BaseModel):
    id: int
    login: str
    full_name: str


class LoginOut(BaseModel):
    token: str
    expires_at: datetime
    admin: AdminOut


# ── Отметки КП ─────────────────────────────────────────────────────────

class CheckpointPassIn(BaseModel):
    race_participant_id: int
    stage_checkpoint_id: int
    # Время с часовым поясом, например 2027-02-18T14:58:00+12:00 (Камчатка) или ...Z (UTC).
    arrived_at: AwareDatetime
    departed_at: AwareDatetime | None = None
    note: str | None = Field(None, max_length=2000)


class CheckpointPassPatch(BaseModel):
    expected_updated_at: AwareDatetime
    arrived_at: AwareDatetime | None = None
    departed_at: AwareDatetime | None = None
    note: str | None = Field(None, max_length=2000)


class CheckpointPassOut(BaseModel):
    id: int
    race_participant_id: int
    stage_checkpoint_id: int
    arrived_at: datetime
    departed_at: datetime | None
    entered_by: str | None
    note: str | None
    updated_at: datetime


class CheckpointPassLogOut(BaseModel):
    id: int
    checkpoint_pass_id: int | None
    race_participant_id: int
    stage_checkpoint_id: int
    action: str
    before: dict | None
    after: dict | None
    changed_by: str
    changed_at: datetime


# ── SOS ────────────────────────────────────────────────────────────────

class AlertAcknowledgeIn(BaseModel):
    # Обязательно: что сделали и почему закрываем (ложный сигнал, связались, помощь оказана).
    note: str = Field(min_length=3, max_length=2000)


class AlertOut(BaseModel):
    id: int
    race_participant_id: int | None
    start_number: int | None
    full_name: str | None
    imei: str
    type: str
    occurred_at: datetime
    latitude: float | None
    longitude: float | None
    acknowledged_at: datetime | None
    acknowledged_by: str | None
    note: str | None


# ── Мониторинг ─────────────────────────────────────────────────────────

class MonitoringCheckpoint(BaseModel):
    stage_checkpoint_id: int
    order_index: int
    role: str
    label: str | None
    name: str


class TrackerShort(BaseModel):
    imei: str
    name: str | None


class LastPoint(BaseModel):
    position_at: datetime
    latitude: float
    longitude: float
    battery_percent: float | None


class MonitoringRow(BaseModel):
    race_participant_id: int
    start_number: int
    full_name: str
    discipline: DisciplineShort
    status: str
    tracker: TrackerShort | None          # null — трекер не привязан
    last_position: LastPoint | None       # null — с начала этапа точек нет
    minutes_since_last: int | None
    is_overdue: bool                      # нет данных дольше порога этапа (только на идущем этапе)
    active_alerts: list[AlertOut]
    passes: list[CheckpointPassOut]       # отметки судей на КП этого этапа


class MonitoringSummary(BaseModel):
    total: int
    sos: int
    overdue: int
    no_tracker: int
    ok: int


class StageMonitoring(BaseModel):
    stage: StageShort
    race_id: int
    generated_at: datetime
    tracking_interval_minutes: int
    stale_after_minutes: int
    checkpoints: list[MonitoringCheckpoint]
    summary: MonitoringSummary
    rows: list[MonitoringRow]             # сначала SOS, потом просрочка, потом по номеру
