"""
Схемы ответов публичного контента: программа, FAQ и зрительские локации.

Время событий — UTC, ISO 8601. Служебные поля публикации и аудита не выдаём.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import LocationType, ProgramEventType


class SpectatorLocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int
    stage_id: int | None
    location_type: LocationType
    name: str
    description: str | None
    latitude: float
    longitude: float
    address: str | None
    how_to_get_there: str | None
    image_urls: list[str]
    sort_order: int


class ProgramEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int
    stage_id: int | None
    event_type: ProgramEventType
    title: str
    description: str | None
    start_at: datetime
    end_at: datetime | None
    image_urls: list[str]
    # Отсутствующая или неопубликованная локация — null.
    location: SpectatorLocationOut | None
    sort_order: int


class FaqItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    answer: str
    sort_order: int


class OrganizerContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    name: str | None
    phone: str | None
    email: str | None
    url: str | None
    sort_order: int
