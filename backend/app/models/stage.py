"""
Этапы и контрольные пункты (КП).

Этап — один день/отрезок гонки. У каждого этапа свой список КП по порядку:
старт → КП-1 → КП-2 → ... → финиш.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.enums import CheckpointType

if TYPE_CHECKING:
    from app.models.season import Season


class Stage(TimestampMixin, db.Model):
    __tablename__ = "stages"
    __table_args__ = (
        UniqueConstraint("season_id", "number", name="uq_stage_season_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3...
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))  # плановый старт, UTC
    distance_km: Mapped[Optional[float]] = mapped_column(Float)

    # Если пусто — берём значение из сезона. Так можно учащать точки
    # на отдельных этапах (по брифу интервал «может различаться по этапам»).
    tracking_interval_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    stale_after_minutes: Mapped[Optional[int]] = mapped_column(Integer)

    season: Mapped["Season"] = relationship(back_populates="stages")
    checkpoints: Mapped[list["Checkpoint"]] = relationship(
        back_populates="stage", order_by="Checkpoint.order_index", cascade="all, delete-orphan"
    )

    @property
    def effective_interval_minutes(self) -> int:
        """Интервал трекинга для этапа с учётом значения сезона."""
        return self.tracking_interval_minutes or self.season.tracking_interval_minutes

    @property
    def effective_stale_after_minutes(self) -> int:
        """Порог «позиция неактуальна» с учётом значения сезона."""
        return self.stale_after_minutes or self.season.stale_after_minutes

    def __repr__(self) -> str:
        return f"<Stage {self.number} {self.name}>"


class Checkpoint(TimestampMixin, db.Model):
    __tablename__ = "checkpoints"
    __table_args__ = (
        UniqueConstraint("stage_id", "order_index", name="uq_checkpoint_stage_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id"), nullable=False, index=True)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False)  # порядок на этапе: 0, 1, 2...
    code: Mapped[str] = mapped_column(String(20), nullable=False)      # «КП-3», «СТАРТ»
    name: Mapped[str] = mapped_column(String(200), nullable=False)     # «Налычево»
    type: Mapped[CheckpointType] = mapped_column(
        Enum(CheckpointType, native_enum=False, length=20),
        default=CheckpointType.CHECKPOINT,
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(Text)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    elevation_m: Mapped[Optional[float]] = mapped_column(Float)          # для профиля высот
    km_from_stage_start: Mapped[Optional[float]] = mapped_column(Float)  # километраж

    # Обязательная остановка на этом КП, в минутах (0 — не нужна).
    required_rest_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    stage: Mapped["Stage"] = relationship(back_populates="checkpoints")

    def __repr__(self) -> str:
        return f"<Checkpoint {self.code} stage={self.stage_id}>"
