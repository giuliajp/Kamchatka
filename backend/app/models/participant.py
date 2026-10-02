"""
Участники.

Разделяем две вещи:
- Participant — сам каюр (человек). Он может участвовать много лет подряд.
- Entry — участие каюра в конкретном сезоне: стартовый номер, дисциплина,
  число собак, статус. Каждый год у каюра новая запись Entry.

Всё, что связано с гонкой (отметки, штрафы, трекер, «Болею за»),
привязывается к Entry, а не к Participant.
"""
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.enums import EntryStatus

if TYPE_CHECKING:
    from app.models.results import CheckpointMark, Penalty
    from app.models.season import Season
    from app.models.tracking import TrackerAssignment


class Discipline(TimestampMixin, db.Model):
    """Дисциплина гонки (например, «Упряжка 12 собак»). Нужна для фильтров."""
    __tablename__ = "disciplines"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    def __repr__(self) -> str:
        return f"<Discipline {self.code}>"


class Participant(TimestampMixin, db.Model):
    """Каюр — человек."""
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[Optional[str]] = mapped_column(String(200))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))

    entries: Mapped[list["Entry"]] = relationship(back_populates="participant")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<Participant {self.full_name}>"


class Entry(TimestampMixin, db.Model):
    """Участие каюра в сезоне."""
    __tablename__ = "entries"
    __table_args__ = (
        # В одном сезоне стартовые номера не повторяются.
        UniqueConstraint("season_id", "bib_number", name="uq_entry_season_bib"),
        # Один каюр заявлен в сезоне один раз.
        UniqueConstraint("season_id", "participant_id", name="uq_entry_season_participant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), nullable=False, index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"), nullable=False, index=True)
    discipline_id: Mapped[Optional[int]] = mapped_column(ForeignKey("disciplines.id"))

    bib_number: Mapped[int] = mapped_column(Integer, nullable=False)  # стартовый номер
    dogs_count: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[EntryStatus] = mapped_column(
        Enum(EntryStatus, native_enum=False, length=20),
        default=EntryStatus.REGISTERED,
        nullable=False,
    )

    season: Mapped["Season"] = relationship(back_populates="entries")
    participant: Mapped["Participant"] = relationship(back_populates="entries")
    discipline: Mapped[Optional["Discipline"]] = relationship()

    checkpoint_marks: Mapped[list["CheckpointMark"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan"
    )
    penalties: Mapped[list["Penalty"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan"
    )
    tracker_assignments: Mapped[list["TrackerAssignment"]] = relationship(
        back_populates="entry"
    )

    def __repr__(self) -> str:
        return f"<Entry #{self.bib_number} season={self.season_id}>"
