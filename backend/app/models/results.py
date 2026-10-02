"""
Официальные результаты.

По брифу официальное время — ТОЛЬКО отметки судей на КП.
Данные трекеров для результатов не используются.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.participant import Entry
    from app.models.stage import Checkpoint, Stage


class CheckpointMark(TimestampMixin, Base):
    """Отметка судьи: участник прошёл КП в такое-то время."""
    __tablename__ = "checkpoint_marks"
    __table_args__ = (
        # Одна отметка на участника на КП. Исправление — редактированием.
        UniqueConstraint("entry_id", "checkpoint_id", name="uq_mark_entry_checkpoint"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id"), nullable=False, index=True)
    checkpoint_id: Mapped[int] = mapped_column(ForeignKey("checkpoints.id"), nullable=False, index=True)

    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Время ухода с КП — нужно для контроля обязательных остановок.
    departed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    entered_by: Mapped[Optional[str]] = mapped_column(String(200))  # кто внёс (позже — ссылка на админа)
    note: Mapped[Optional[str]] = mapped_column(Text)

    entry: Mapped["Entry"] = relationship(lazy="raise_on_sql", back_populates="checkpoint_marks")
    checkpoint: Mapped["Checkpoint"] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<CheckpointMark entry={self.entry_id} cp={self.checkpoint_id}>"


class Penalty(TimestampMixin, Base):
    """Штраф участнику (в минутах)."""
    __tablename__ = "penalties"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id"), nullable=False, index=True)
    stage_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stages.id"), index=True)

    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    entry: Mapped["Entry"] = relationship(lazy="raise_on_sql", back_populates="penalties")
    stage: Mapped[Optional["Stage"]] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<Penalty entry={self.entry_id} {self.minutes} min>"
