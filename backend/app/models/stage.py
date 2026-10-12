"""
Этапы и контрольные пункты.

- Stage           — этап гонки (старт → финиш), количество этапов не фиксировано.
- Checkpoint      — ФИЗИЧЕСКОЕ место (Центральный кордон). Переиспользуется между этапами и годами.
- StageCheckpoint — роль места на конкретном этапе: порядок, км от старта, старт/КП/финиш.
                    Старт и финиш этапа — первая и последняя запись.
- CheckpointPass  — отметка прохождения КП для ЖИВОЙ трансляции.
                    НЕ официальное время: официальные результаты — только из протокола.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import (
    JSON, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, str_enum
from app.models.enums import CheckpointRole, StageStatus

if TYPE_CHECKING:
    from app.models.race import Race, RaceParticipant


class Stage(TimestampMixin, Base):
    __tablename__ = "stages"
    __table_args__ = (
        UniqueConstraint("race_id", "number", name="uq_stages_race_number"),
        CheckConstraint("distance_km IS NULL OR distance_km > 0", name="distance_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)    # 1, 2, 3...
    name: Mapped[Optional[str]] = mapped_column(String(200))         # «Центральный кордон — Пиначево»
    description: Mapped[Optional[str]] = mapped_column(Text)
    distance_km: Mapped[Optional[float]] = mapped_column(Float)     # 33,7 км — как в протоколе

    # Плановые дата и время (UTC). Этап может закончиться после полуночи.
    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finish_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[StageStatus] = mapped_column(
        str_enum(StageStatus), default=StageStatus.PLANNED, nullable=False
    )

    # Трек этапа. Загружается из KML/GPX через админку и может ЗАМЕНЯТЬСЯ во время гонки
    # (погода, ЧС). Храним как GeoJSON LineString; высоты — третья координата.
    route_geojson: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    route_source_filename: Mapped[Optional[str]] = mapped_column(String(255))
    route_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Если пусто — берём значение гонки. Так можно учащать точки на отдельных этапах.
    tracking_interval_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    stale_after_minutes: Mapped[Optional[int]] = mapped_column(Integer)

    race: Mapped["Race"] = relationship(lazy="raise_on_sql", back_populates="stages")
    stage_checkpoints: Mapped[list["StageCheckpoint"]] = relationship(
        lazy="raise_on_sql", back_populates="stage", order_by="StageCheckpoint.order_index",
        cascade="all, delete-orphan",
    )

    @property
    def effective_interval_minutes(self) -> int:
        """Интервал трекинга с учётом гонки. Гонка должна быть загружена: selectinload(Stage.race)."""
        return self.tracking_interval_minutes or self.race.tracking_interval_minutes

    @property
    def effective_stale_after_minutes(self) -> int:
        """Порог «неактуально» с учётом гонки (гонка должна быть загружена)."""
        return self.stale_after_minutes or self.race.stale_after_minutes

    def __repr__(self) -> str:
        return f"<Stage {self.number} race={self.race_id}>"


class Checkpoint(TimestampMixin, Base):
    """Физическое место: Пиначево, Семёновский кордон, Центральный кордон, Биатлонный комплекс."""
    __tablename__ = "checkpoints"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    elevation_m: Mapped[Optional[float]] = mapped_column(Float)

    def __repr__(self) -> str:
        return f"<Checkpoint {self.name}>"


class StageCheckpoint(TimestampMixin, Base):
    """
    КП на конкретном этапе. Одно место может встречаться на этапе дважды
    (например, старт и финиш в одном месте), поэтому уникален только порядок.
    """
    __tablename__ = "stage_checkpoints"
    __table_args__ = (
        UniqueConstraint("stage_id", "order_index", name="uq_stage_checkpoints_stage_order"),
        CheckConstraint("km_from_start IS NULL OR km_from_start >= 0", name="km_non_negative"),
        CheckConstraint("required_rest_minutes >= 0", name="rest_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    checkpoint_id: Mapped[int] = mapped_column(ForeignKey("checkpoints.id"), nullable=False, index=True)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False)   # 0 — старт
    role: Mapped[CheckpointRole] = mapped_column(
        str_enum(CheckpointRole), default=CheckpointRole.CHECKPOINT, nullable=False
    )
    label: Mapped[Optional[str]] = mapped_column(String(50))             # «КП-3»
    km_from_start: Mapped[Optional[float]] = mapped_column(Float)
    # Обязательная остановка на этом КП, минуты (0 — не нужна).
    required_rest_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Описание участка ДО этого КП (для экрана «Маршрут»).
    segment_description: Mapped[Optional[str]] = mapped_column(Text)

    stage: Mapped["Stage"] = relationship(lazy="raise_on_sql", back_populates="stage_checkpoints")
    checkpoint: Mapped["Checkpoint"] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<StageCheckpoint stage={self.stage_id} #{self.order_index}>"


class CheckpointPass(TimestampMixin, Base):
    """
    Отметка прохождения КП (для трансляции и карты: «последняя подтверждённая точка»).
    Официальные результаты отсюда НЕ считаются.
    """
    __tablename__ = "checkpoint_passes"
    __table_args__ = (
        UniqueConstraint("race_participant_id", "stage_checkpoint_id",
                         name="uq_checkpoint_passes_participant_stage_checkpoint"),
        CheckConstraint("departed_at IS NULL OR departed_at >= arrived_at", name="departed_after_arrived"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_participant_id: Mapped[int] = mapped_column(
        ForeignKey("race_participants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_checkpoint_id: Mapped[int] = mapped_column(
        ForeignKey("stage_checkpoints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    departed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))  # для обязательных остановок
    entered_by: Mapped[Optional[str]] = mapped_column(String(200))
    note: Mapped[Optional[str]] = mapped_column(Text)

    race_participant: Mapped["RaceParticipant"] = relationship(lazy="raise_on_sql")
    stage_checkpoint: Mapped["StageCheckpoint"] = relationship(lazy="raise_on_sql")
