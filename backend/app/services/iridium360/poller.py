"""
Фоновый опрос Iridium360: запускается вместе с сервером (app/main.py, lifespan).

Включается, только если в backend/.env задан IRIDIUM360_API_KEY и
TRACKER_POLLING_ENABLED не выключен. Частота — TRACKER_POLL_INTERVAL_SECONDS.

Любая ошибка цикла записывается в лог, но опрос не останавливается:
Iridium бывает недоступен, и это нормальная ситуация (бриф: приложение работает
на последних сохранённых данных).
"""

from __future__ import annotations

import asyncio
import logging

from app.config import get_settings
from app.db import SessionLocal
from app.services.iridium360.client import Iridium360Client
from app.services.iridium360.ingest import poll_once

# Пишем в лог uvicorn, чтобы сообщения опроса были видны в терминале сервера.
logger = logging.getLogger("uvicorn.error").getChild("iridium360")


def polling_enabled() -> bool:
    settings = get_settings()
    return bool(settings.iridium360_api_key) and settings.tracker_polling_enabled


async def run_poller(stop: asyncio.Event) -> None:
    interval = max(get_settings().tracker_poll_interval_seconds, 15)
    logger.info("Опрос Iridium360 включён, каждые %s сек.", interval)
    async with Iridium360Client() as client:
        while not stop.is_set():
            try:
                await poll_once(SessionLocal, client)
            except Exception:   # noqa: BLE001 — опрос не должен умирать от одной ошибки
                logger.exception("Ошибка цикла опроса Iridium360")
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
            except TimeoutError:
                pass
