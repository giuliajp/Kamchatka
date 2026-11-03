"""
Публичный контент приложения: программа фестиваля, FAQ и зрительские локации.

Событие может ссылаться на локацию; одно место используется разными событиями.
Новые записи — черновики (is_published=False). Время событий храним в UTC.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    JSON,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, str_enum
from app.models.enums import LocationType, ProgramEventType


class SpectatorLocation(TimestampMixin, Base):
    """Место для зрителей: точка на карте, адрес и описание проезда."""

    __tablename__ = "spectator_locations"
    __table_args__ = (
        CheckConstraint(
            "location_type IN ('start', 'finish', 'festival', 'viewpoint', 'checkpoint')",
            name="location_type_valid",
        ),
        ForeignKeyConstraint(
            ["stage_id", "race_id"],
            ["stages.id", "stages.race_id"],
            name="fk_spectator_locations_stage_race",
            ondelete="RESTRICT",
        ),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="latitude_range"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="longitude_range"),
        CheckConstraint("sort_order >= 0", name="sort_order_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(
        ForeignKey("races.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(index=True)
    location_type: Mapped[LocationType] = mapped_column(
        str_enum(LocationType), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    how_to_get_there: Mapped[Optional[str]] = mapped_column(Text)
    # Фото места для карусели в карточке (ссылки).
    image_urls: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<SpectatorLocation {self.name}>"


class ProgramEvent(TimestampMixin, Base):
    """Событие программы; время окончания и локация могут быть ещё неизвестны."""

    __tablename__ = "program_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('stage_start', 'stage_finish', 'festival', 'master_class', 'meeting')",
            name="event_type_valid",
        ),
        ForeignKeyConstraint(
            ["stage_id", "race_id"],
            ["stages.id", "stages.race_id"],
            name="fk_program_events_stage_race",
            ondelete="RESTRICT",
        ),
        CheckConstraint("end_at IS NULL OR end_at >= start_at", name="end_after_start"),
        CheckConstraint("sort_order >= 0", name="sort_order_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(
        ForeignKey("races.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(index=True)
    event_type: Mapped[ProgramEventType] = mapped_column(
        str_enum(ProgramEventType), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Фото события для карусели в карточке (ссылки).
    image_urls: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    # Удаление локации сохраняет событие, очищая ссылку на место.
    location_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("spectator_locations.id", ondelete="SET NULL"), index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)

    location: Mapped[Optional["SpectatorLocation"]] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<ProgramEvent {self.title}>"


class FaqItem(TimestampMixin, Base):
    """Вопрос и ответ для раздела «Гостям»."""

    __tablename__ = "faq_items"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="sort_order_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<FaqItem {self.question}>"


class OrganizerContact(TimestampMixin, Base):
    """Общие контакты организаторов; новые записи скрыты до публикации."""

    __tablename__ = "organizer_contacts"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="sort_order_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    url: Mapped[Optional[str]] = mapped_column(String(2000))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)
