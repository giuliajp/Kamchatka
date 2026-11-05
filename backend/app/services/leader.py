"""
Фоновые задачи — только в одном процессе.

На сервере uvicorn запускается с несколькими процессами (--workers 4). Без защиты каждый
процесс опрашивал бы Iridium и рассылал напоминания сам — напоминания пришли бы по 4 раза.
Поэтому задачу выполняет тот процесс, который первым взял «замок» в PostgreSQL
(pg_try_advisory_lock). Остальные раз в минуту проверяют, не освободился ли замок:
если процесс-исполнитель упал, его соединение закрывается, и замок берёт другой.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("uvicorn.error").getChild("leader")

POLLER_LOCK = 7_301_001
REMINDERS_LOCK = 7_301_002
RETRY_SECONDS = 60


async def run_as_leader(engine: AsyncEngine, key: int, stop: asyncio.Event,
                        job: Callable[[asyncio.Event], Awaitable[None]], *, retry: float = RETRY_SECONDS) -> None:
    while not stop.is_set():
        try:
            async with engine.connect() as connection:
                if await connection.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": key}):
                    try:
                        await job(stop)
                    finally:
                        await connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
                    return
        except Exception:   # noqa: BLE001 — нет базы: попробуем позже
            logger.exception("Не удалось взять замок фоновой задачи %s", key)
        try:
            await asyncio.wait_for(stop.wait(), timeout=retry)
        except TimeoutError:
            pass
