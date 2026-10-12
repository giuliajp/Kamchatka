"""
Трекеры и позиции.

- TrackerDevice      — физическое устройство Iridium (IMEI). Переиспользуется из года в год.
- TrackerAssignment  — какой трекер у какого участника гонки, с какого по какое время
                       (бриф: «IMEI → участник → этап» ведётся в админке; трекер могут заменить).
- TrackerPosition    — одна подтверждённая точка. race_participant_id фиксируется в момент
                       получения, чтобы история не «переезжала» при перепривязке трекера.
- TrackerAlert       — SOS. ТОЛЬКО для админки, в публичное API не отдаётся.

Расчётное (интерполированное) положение в базе не храним — считаем при запросе.
Скорость с устройства храним, но пользователю показываем среднюю между двумя точками.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, str_enum, utcnow
from app.models.enums import AlertType, PositionSource

if TYPE_CHECKING:
    from app.models.race import RaceParticipant


class TrackerDevice(TimestampMixin, Base):
    __tablename__ = "tracker_devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    imei: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(100))     # «Трекер 07» — для людей
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<TrackerDevice {self.imei}>"


class TrackerAssignment(TimestampMixin, Base):
    """
    valid_to пусто → привязка действует сейчас.
    stage_id пусто → на всю гонку.
    """
    __tablename__ = "tracker_assignments"
    __table_args__ = (
        CheckConstraint("valid_to IS NULL OR valid_to > valid_from", name="valid_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_device_id: Mapped[int] = mapped_column(ForeignKey("tracker_devices.id"), nullable=False, index=True)
    race_participant_id: Mapped[int] = mapped_column(
        ForeignKey("race_participants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"))
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    valid_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    tracker_device: Mapped["TrackerDevice"] = relationship(lazy="raise_on_sql")
    race_participant: Mapped["RaceParticipant"] = relationship(lazy="raise_on_sql")


class TrackerPosition(Base):
    """Подтверждённая точка. Самая большая таблица — без updated_at, с индексами."""
    __tablename__ = "tracker_positions"
    __table_args__ = (
        # Защита от дублей при повторном опросе Iridium:
        # по идентификатору точки платформы (если есть) и по времени точки.
        UniqueConstraint("tracker_device_id", "external_point_id", name="uq_tracker_positions_device_external"),
        UniqueConstraint("tracker_device_id", "position_at", name="uq_tracker_positions_device_time"),
        Index("ix_tracker_positions_participant_time", "race_participant_id", "position_at"),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="lat_range"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="lon_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_device_id: Mapped[int] = mapped_column(ForeignKey("tracker_devices.id"), nullable=False)
    race_participant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("race_participants.id", ondelete="SET NULL")
    )
    stage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stages.id", ondelete="SET NULL"))

    external_point_id: Mapped[Optional[str]] = mapped_column(String(100))   # id точки в Iridium360
    position_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # время на устройстве
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    altitude_m: Mapped[Optional[float]] = mapped_column(Float)
    course_deg: Mapped[Optional[float]] = mapped_column(Float)
    device_speed_kmh: Mapped[Optional[float]] = mapped_column(Float)   # со слов устройства, публично не показываем
    battery_percent: Mapped[Optional[float]] = mapped_column(Float)    # для мониторинга в админке

    source: Mapped[PositionSource] = mapped_column(
        str_enum(PositionSource), default=PositionSource.IRIDIUM, nullable=False
    )

    tracker_device: Mapped["TrackerDevice"] = relationship(lazy="raise_on_sql")
    race_participant: Mapped[Optional["RaceParticipant"]] = relationship(lazy="raise_on_sql")


class TrackerAlert(TimestampMixin, Base):
    """
    SOS. Отдельная таблица, а не флажок в позициях — чтобы его невозможно было
    случайно показать на публичной карте. Состав полей уточним по API Iridium360 (задача 1.4).
    """
    __tablename__ = "tracker_alerts"
    __table_args__ = (
        UniqueConstraint("tracker_device_id", "occurred_at", name="uq_tracker_alerts_device_time"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_device_id: Mapped[int] = mapped_column(ForeignKey("tracker_devices.id"), nullable=False, index=True)
    race_participant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("race_participants.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[AlertType] = mapped_column(str_enum(AlertType), default=AlertType.SOS, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    external_id: Mapped[Optional[str]] = mapped_column(String(100))

    # Организатор отмечает, что увидел сигнал и принял меры.
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(200))
    note: Mapped[Optional[str]] = mapped_column(Text)

    tracker_device: Mapped["TrackerDevice"] = relationship(lazy="raise_on_sql")
    race_participant: Mapped[Optional["RaceParticipant"]] = relationship(lazy="raise_on_sql")
