"""
Гонка, дисциплины, участники.

- Race            — одно проведение гонки («Берингия. Авача 2027»). Даёт архив прошлых лет.
- Discipline      — дисциплина («Нарта, 8 собак»). Справочник, редактируется в админке.
- Participant     — спортсмен как человек. Существует независимо от гонок.
- RaceParticipant — участие человека в конкретной гонке: номер, дисциплина, статус.
                    Всё, что связано с гонкой (результаты, трекер, отметки), ссылается сюда.
"""
from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, str_enum
from app.models.enums import Equipment, RaceParticipantStatus, RaceStatus

if TYPE_CHECKING:
    from app.models.stage import Stage


class Race(TimestampMixin, Base):
    __tablename__ = "races"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)   # «Берингия. Авача 2027»
    year: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    status: Mapped[RaceStatus] = mapped_column(
        str_enum(RaceStatus), default=RaceStatus.UPCOMING, nullable=False
    )
    # Какую гонку показывать в приложении по умолчанию.
    is_current: Mapped[bool] = mapped_column(default=False, nullable=False)

    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    location: Mapped[Optional[str]] = mapped_column(String(200))

    # Настройки трекинга по умолчанию (этап может переопределить).
    # Интервал передачи точек трекером, минуты. По брифу базовый — 20.
    tracking_interval_minutes: Mapped[int] = mapped_column(default=20, nullable=False)
    # Через сколько минут без новых точек позиция считается неактуальной (> 2 интервалов).
    stale_after_minutes: Mapped[int] = mapped_column(default=45, nullable=False)

    stages: Mapped[list["Stage"]] = relationship(
        lazy="raise_on_sql", back_populates="race", order_by="Stage.number",
        cascade="all, delete-orphan",
    )
    participants: Mapped[list["RaceParticipant"]] = relationship(
        lazy="raise_on_sql", back_populates="race", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Race {self.year} {self.status.value}>"


class Discipline(TimestampMixin, Base):
    """
    Дисциплина. В 2026: «Лыжи, 2 собаки», «Нарта, 8 собак», «Нарта, более 8 собак».
    Места считаются внутри дисциплины, общего зачёта между дисциплинами нет.
    """
    __tablename__ = "disciplines"
    __table_args__ = (
        CheckConstraint("dogs_min > 0", name="dogs_min_positive"),
        CheckConstraint("dogs_max IS NULL OR dogs_max >= dogs_min", name="dogs_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)   # "sled_8"
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # «Нарта — длинная дистанция, 8 собак»
    equipment: Mapped[Equipment] = mapped_column(str_enum(Equipment), nullable=False)
    # Число собак: «8 собак» → 8..8, «более 8» → 9..пусто
    dogs_min: Mapped[int] = mapped_column(Integer, nullable=False)
    dogs_max: Mapped[Optional[int]] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Discipline {self.code}>"


class Participant(TimestampMixin, Base):
    """
    Спортсмен (каюр). Один человек — одна запись на все годы.
    При импорте протоколов человека узнаём по ФИО + году рождения.
    """
    __tablename__ = "participants"
    __table_args__ = (
        # Для поиска «тот же человек» при импорте. Не уникальный: решение принимает импорт.
        Index("ix_participants_identity", "last_name", "first_name", "middle_name", "birth_year"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100))   # отчество
    birth_year: Mapped[Optional[int]] = mapped_column(Integer)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))
    bio: Mapped[Optional[str]] = mapped_column(Text)

    race_entries: Mapped[list["RaceParticipant"]] = relationship(
        lazy="raise_on_sql", back_populates="participant"
    )

    @property
    def full_name(self) -> str:
        return " ".join(p for p in (self.last_name, self.first_name, self.middle_name) if p)

    def __repr__(self) -> str:
        return f"<Participant {self.full_name}>"


class RaceParticipant(TimestampMixin, Base):
    """Участие спортсмена в конкретной гонке."""
    __tablename__ = "race_participants"
    __table_args__ = (
        UniqueConstraint("race_id", "start_number", name="uq_race_participants_race_start_number"),
        UniqueConstraint("race_id", "participant_id", name="uq_race_participants_race_participant"),
        CheckConstraint("dogs_count IS NULL OR dogs_count > 0", name="dogs_count_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"), nullable=False, index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("disciplines.id"), nullable=False, index=True)

    start_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # Регион — как указан в протоколе этого года (человек мог переехать).
    region: Mapped[Optional[str]] = mapped_column(String(200))
    # Заявленное число собак. Фактическое на старте/финише этапа — в StageResult.
    dogs_count: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[RaceParticipantStatus] = mapped_column(
        str_enum(RaceParticipantStatus), default=RaceParticipantStatus.REGISTERED, nullable=False
    )

    race: Mapped["Race"] = relationship(lazy="raise_on_sql", back_populates="participants")
    participant: Mapped["Participant"] = relationship(lazy="raise_on_sql", back_populates="race_entries")
    discipline: Mapped["Discipline"] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<RaceParticipant #{self.start_number} race={self.race_id}>"
