"""
Общие вещи для всех моделей.

Важно: ВСЕ даты и время в базе храним в UTC.
Камчатка — это UTC+12, переводим в местное время только при показе пользователю.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    """Текущее время в UTC."""
    return datetime.now(timezone.utc)


class TimestampMixin:
    """Добавляет в таблицу поля «когда создано» и «когда изменено»."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
