"""
Сезон — это одна гонка одного года (например, «Авача-2027»).
Благодаря сезонам у нас сразу есть архив прошлых лет.
"""
from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.enums import SeasonStatus

if TYPE_CHECKING:
    from app.models.participant import Entry
    from app.models.stage import Stage


class Season(TimestampMixin, db.Model):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Режим «до гонки / идёт / завершена» — переключает организатор.
    status: Mapped[SeasonStatus] = mapped_column(
        Enum(SeasonStatus, native_enum=False, length=20),
        default=SeasonStatus.UPCOMING,
        nullable=False,
    )
    # Нужен текущему сезону, чтобы фронтенд понимал, какой сезон показывать.
    is_current: Mapped[bool] = mapped_column(default=False, nullable=False)

    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)

    # Настройки трекинга по умолчанию (этап может их переопределить).
    # Интервал передачи точек трекером, в минутах. По брифу базовый — 20.
    tracking_interval_minutes: Mapped[int] = mapped_column(default=20, nullable=False)
    # Через сколько минут без новых точек позиция считается неактуальной.
    # По брифу: пропущено более двух интервалов → при 20 мин это 45 мин.
    stale_after_minutes: Mapped[int] = mapped_column(default=45, nullable=False)

    stages: Mapped[list["Stage"]] = relationship(
        back_populates="season", order_by="Stage.number", cascade="all, delete-orphan"
    )
    entries: Mapped[list["Entry"]] = relationship(
        back_populates="season", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Season {self.year} {self.status.value}>"
