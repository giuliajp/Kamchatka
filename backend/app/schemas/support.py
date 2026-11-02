"""Схемы «Болею за»: подписка, счётчик, рейтинг народной поддержки."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.races import DisciplineShort


class SupportState(BaseModel):
    race_participant_id: int
    supporters_count: int
    change_24h: int
    # null — пользователь не определён (открыто не из VK)
    is_supported: bool | None
    notifications_enabled: bool | None


class MySupport(BaseModel):
    race_participant_id: int
    race_id: int
    start_number: int
    full_name: str
    photo_url: str | None
    discipline: DisciplineShort
    notifications_enabled: bool
    supported_since: datetime


class NotificationsIn(BaseModel):
    notifications_enabled: bool


class CancelledOut(BaseModel):
    cancelled: int


class RatingItem(BaseModel):
    rank: int
    race_participant_id: int
    start_number: int
    full_name: str
    photo_url: str | None
    discipline: DisciplineShort
    supporters_count: int
    change_24h: int


class PublicCheckpointPass(BaseModel):
    """Отметка судьи на КП — для карточки участника (без служебных полей)."""
    stage_id: int
    stage_number: int
    stage_checkpoint_id: int
    order_index: int
    role: str
    label: str | None
    name: str
    km_from_start: float | None
    required_rest_minutes: int
    arrived_at: datetime
    departed_at: datetime | None
