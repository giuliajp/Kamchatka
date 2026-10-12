"""
Общие вещи для всех моделей.

Важно:
- ВСЕ даты и время в базе храним в UTC. Камчатка — UTC+12, переводим только при показе.
- Длительности (время этапа, штраф) храним целым числом СЕКУНД.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    """Текущее время в UTC."""
    return datetime.now(timezone.utc)


def str_enum(enum_cls: type[enum.Enum]) -> Enum:
    """
    Колонка-перечисление. В базе хранится ЗНАЧЕНИЕ элемента ("preliminary", "dnf"),
    а не имя ("PRELIMINARY") — так данные в базе совпадают с тем, что видит API.
    """
    return Enum(
        enum_cls,
        native_enum=False,
        length=32,
        values_callable=lambda cls: [member.value for member in cls],
        validate_strings=True,
    )


class TimestampMixin:
    """Добавляет в таблицу поля «когда создано» и «когда изменено»."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
