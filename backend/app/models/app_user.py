"""
Пользователи мини-приложения, новости в закладках и история push-рассылок.

- AppUser      — кто открывал приложение и разрешил ли уведомления (VKWebAppAllowNotifications).
                 Нужен для рассылок «всем»: VK отправляет уведомления только по списку id.
- Bookmark     — «Сохранённые материалы» в профиле: новость или фото из сообщества VK.
- PushMessage  — журнал рассылок: что, кому, сколько доставлено, ошибки.
- EventReminder — напоминание о событии программы (колокольчик в карточке события).
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import utcnow


class AppUser(Base):
    __tablename__ = "app_users"

    vk_user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    notifications_allowed: Mapped[bool] = mapped_column(default=False, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (
        UniqueConstraint("vk_user_id", "kind", "item_id", name="uq_bookmarks_user_item"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    vk_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)        # "news" | "photo"
    item_id: Mapped[str] = mapped_column(String(100), nullable=False)    # "-123_456" (VK)
    title: Mapped[Optional[str]] = mapped_column(String(300))
    url: Mapped[Optional[str]] = mapped_column(String(1000))
    image_url: Mapped[Optional[str]] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class PushMessage(Base):
    __tablename__ = "push_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Кому: "all" — все разрешившие; "supporters:<id>" — болельщики участника гонки.
    segment: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(String(300), nullable=False)
    fragment: Mapped[Optional[str]] = mapped_column(String(200))   # куда открыть приложение
    trigger: Mapped[str] = mapped_column(String(50), nullable=False)  # manual, checkpoint, protocol...
    recipients: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class EventReminder(Base):
    """Колокольчик у события программы: push за REMINDER_MINUTES_BEFORE минут до начала."""
    __tablename__ = "event_reminders"
    __table_args__ = (
        UniqueConstraint("vk_user_id", "program_event_id", name="uq_event_reminders_user_event"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    vk_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    program_event_id: Mapped[int] = mapped_column(
        ForeignKey("program_events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
