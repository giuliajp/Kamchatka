"""
Push-уведомления (задача 3.7) через notifications.sendMessage VK.

Кому:
- "all"            — все, кто разрешил уведомления в приложении (AppUser.notifications_allowed);
- "supporters:<id>" — болельщики участника гонки с включёнными уведомлениями по нему;
- "reminder:<id>"   — нажавшие колокольчик у события программы (ещё не получившие напоминание).

Правила текста (бриф): событие уже произошло, данные с задержкой — пишем время события
и источник («отметка судьи», «по протоколу»), никогда «прямо сейчас».
Ошибка VK не ломает действие организатора: она записывается в журнал PushMessage.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppUser, EventReminder, PushMessage, SupportSubscription
from app.services import vk_api

logger = logging.getLogger(__name__)
KAMCHATKA = timezone(timedelta(hours=12))


def kamchatka_time(moment: datetime) -> str:
    return moment.astimezone(KAMCHATKA).strftime("%H:%M")


async def recipients(session: AsyncSession, segment: str) -> list[int]:
    if segment == "all":
        return list(await session.scalars(
            select(AppUser.vk_user_id).where(AppUser.notifications_allowed.is_(True))
        ))
    if segment.startswith("supporters:"):
        entry_id = int(segment.split(":", 1)[1])
        # Кто явно запретил уведомления в приложении — пропускаем; кого не знаем — пробуем.
        return list(await session.scalars(
            select(SupportSubscription.vk_user_id)
            .outerjoin(AppUser, AppUser.vk_user_id == SupportSubscription.vk_user_id)
            .where(SupportSubscription.race_participant_id == entry_id,
                   SupportSubscription.cancelled_at.is_(None),
                   SupportSubscription.notifications_enabled.is_(True),
                   AppUser.notifications_allowed.is_not(False))
        ))
    if segment.startswith("reminder:"):
        event_id = int(segment.split(":", 1)[1])
        return list(await session.scalars(
            select(EventReminder.vk_user_id)
            .outerjoin(AppUser, AppUser.vk_user_id == EventReminder.vk_user_id)
            .where(EventReminder.program_event_id == event_id, EventReminder.sent_at.is_(None),
                   AppUser.notifications_allowed.is_not(False))
        ))
    raise ValueError(f"Неизвестный сегмент: {segment}")


async def send(session: AsyncSession, *, segment: str, message: str, trigger: str,
               fragment: str | None = None, created_by: str | None = None) -> PushMessage:
    """Отправить и записать в журнал. Коммит — на вызывающем коде."""
    users = await recipients(session, segment)
    record = PushMessage(segment=segment, message=message[:vk_api.MAX_MESSAGE], fragment=fragment,
                         trigger=trigger, recipients=len(users), created_by=created_by)
    if users:
        try:
            record.delivered = await vk_api.send_notification(users, message, fragment)
        except vk_api.VkApiError as error:
            record.error = str(error)
            logger.warning("Push не отправлен: %s", error)
    session.add(record)
    await session.flush()
    return record
