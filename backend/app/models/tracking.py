"""
Трекеры и позиции.

Цепочка из брифа: устройство (IMEI) → участник → этап.
Платформа Iridium360 такой связи не знает, поэтому храним её у себя
в TrackerAssignment.

Храним только ПОДТВЕРЖДЁННЫЕ точки от трекера.
Расчётное положение (интерполяция по нитке маршрута) не храним —
его считаем «на лету» при запросе к API.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DateTime, Enum, Float, ForeignKey, Index, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, utcnow
from app.models.enums import AlertType, PositionSource

if TYPE_CHECKING:
    from app.models.participant import Entry
    from app.models.stage import Stage


class Tracker(TimestampMixin, Base):
    """Физическое устройство Iridium."""
    __tablename__ = "trackers"

    id: Mapped[int] = mapped_column(primary_key=True)
    imei: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(100))  # «Трекер 07» — для людей
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    assignments: Mapped[list["TrackerAssignment"]] = relationship(lazy="raise_on_sql", back_populates="tracker")

    def __repr__(self) -> str:
        return f"<Tracker {self.imei}>"


class TrackerAssignment(TimestampMixin, Base):
    """
    Какой трекер у какого участника и с какого по какое время.
    stage_id пустой → трекер закреплён на весь сезон.
    active_to пустой → закрепление действует сейчас.
    """
    __tablename__ = "tracker_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_id: Mapped[int] = mapped_column(ForeignKey("trackers.id"), nullable=False, index=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id"), nullable=False, index=True)
    stage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stages.id"))

    active_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    active_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    tracker: Mapped["Tracker"] = relationship(lazy="raise_on_sql", back_populates="assignments")
    entry: Mapped["Entry"] = relationship(lazy="raise_on_sql", back_populates="tracker_assignments")
    stage: Mapped[Optional["Stage"]] = relationship(lazy="raise_on_sql")


class TrackerPosition(Base):
    """
    Одна подтверждённая точка.
    Таблица будет самой большой, поэтому без updated_at и с индексами.
    """
    __tablename__ = "tracker_positions"
    __table_args__ = (
        # Бэкенд опрашивает Iridium по расписанию и может получить
        # одну и ту же точку дважды — это ограничение не даст её задвоить.
        UniqueConstraint("tracker_id", "recorded_at", name="uq_position_tracker_time"),
        # Быстрый поиск «последняя точка участника» и «трек участника».
        Index("ix_position_entry_time", "entry_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_id: Mapped[int] = mapped_column(ForeignKey("trackers.id"), nullable=False)
    # Заполняем при сохранении по TrackerAssignment. Может быть пустым,
    # если точка пришла от трекера, ещё не привязанного к участнику.
    entry_id: Mapped[Optional[int]] = mapped_column(ForeignKey("entries.id"))
    stage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stages.id"))

    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # время точки на устройстве
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)  # когда получили мы

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude_m: Mapped[Optional[float]] = mapped_column(Float)

    source: Mapped[PositionSource] = mapped_column(
        Enum(PositionSource, native_enum=False, length=20),
        default=PositionSource.IRIDIUM,
        nullable=False,
    )

    tracker: Mapped["Tracker"] = relationship(lazy="raise_on_sql")
    entry: Mapped[Optional["Entry"]] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<TrackerPosition tracker={self.tracker_id} {self.recorded_at}>"


class TrackerAlert(TimestampMixin, Base):
    """
    Тревожный сигнал (SOS).
    ВНИМАНИЕ: только для админ-панели. Никогда не отдаём в публичное API.
    Поэтому это отдельная таблица, а не флажок в позициях —
    так его невозможно случайно показать на публичной карте.
    """
    __tablename__ = "tracker_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_id: Mapped[int] = mapped_column(ForeignKey("trackers.id"), nullable=False, index=True)
    entry_id: Mapped[Optional[int]] = mapped_column(ForeignKey("entries.id"), index=True)

    type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, native_enum=False, length=20), default=AlertType.SOS, nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)

    # Организатор отмечает, что увидел сигнал и принял меры.
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(200))
    note: Mapped[Optional[str]] = mapped_column(Text)

    tracker: Mapped["Tracker"] = relationship(lazy="raise_on_sql")
    entry: Mapped[Optional["Entry"]] = relationship(lazy="raise_on_sql")
