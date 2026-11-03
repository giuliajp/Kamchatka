"""
Напоминания о событиях программы (колокольчик в карточке события).

Раз в минуту фоновая задача ищет события, которые начнутся в ближайшие
REMINDER_MINUTES_BEFORE минут, и отправляет push тем, кто нажал колокольчик.
Каждое напоминание отправляется один раз (sent_at). Уже начавшиеся события не напоминаем.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models import EventReminder, ProgramEvent
from app.models.base import utcnow
from app.services import push

logger = logging.getLogger("uvicorn.error").getChild("reminders")


async def send_due_reminders(session: AsyncSession, now: datetime | None = None) -> int:
    """Отправить созревшие напоминания. Возвращает число событий, по которым ушёл push."""
    now = now or utcnow()
    horizon = now + timedelta(minutes=get_settings().reminder_minutes_before)
    events = (await session.scalars(
        select(ProgramEvent).options(selectinload(ProgramEvent.location))
        .where(ProgramEvent.is_published.is_(True), ProgramEvent.start_at > now,
               ProgramEvent.start_at <= horizon,
               ProgramEvent.id.in_(select(EventReminder.program_event_id)
                                   .where(EventReminder.sent_at.is_(None))))
    )).all()
    for event in events:
        place = f" — {event.location.name}" if event.location and event.location.is_published else ""
        await push.send(session, segment=f"reminder:{event.id}", trigger="reminder",
                        fragment=f"program&event={event.id}",
                        message=f"Скоро: «{event.title}» в {push.kamchatka_time(event.start_at)} "
                                f"по Камчатке{place}.")
        reminders = await session.scalars(select(EventReminder).where(
            EventReminder.program_event_id == event.id, EventReminder.sent_at.is_(None)))
        for reminder in reminders:
            reminder.sent_at = now
    await session.commit()
    return len(events)


def reminders_enabled() -> bool:
    return get_settings().reminders_enabled


async def run_reminders(stop: asyncio.Event, factory: async_sessionmaker) -> None:
    while not stop.is_set():
        try:
            async with factory() as session:
                await send_due_reminders(session)
        except Exception:   # noqa: BLE001 — фоновая задача не должна умирать от одной ошибки
            logger.exception("Ошибка отправки напоминаний")
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except TimeoutError:
            pass
