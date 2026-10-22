"""
Сборка приложения FastAPI: настройки, CORS, обработчики ошибок, маршруты.

Запуск: python backend/run.py (из корня репозитория).
Документация API — автоматически: http://127.0.0.1:8000/docs
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, participants, races, stages
from app.config import get_settings
from app.db import engine
from app.middleware.errors import register_error_handlers
from app.services.iridium360.poller import polling_enabled, run_poller


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Фоновый опрос Iridium360 (задача 2.6). Без ключа в .env не запускается.
    stop = asyncio.Event()
    poller = asyncio.create_task(run_poller(stop)) if polling_enabled() else None
    yield
    if poller is not None:
        stop.set()
        await poller
    # При остановке сервера аккуратно закрываем соединения с базой.
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Авача API",
        description="Бэкенд мини-приложения гонки «Авача» и фестиваля «Берингия».",
        version="0.1.0",
        lifespan=lifespan,
    )

    # TODO перед продакшеном: добавить в CORS_ORIGINS реальный домен VK Mini App
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    # ── Маршруты ─────────────────────────────────────────────────────────
    app.include_router(health.router)  # /health — без префикса, для мониторинга

    app.include_router(races.router, prefix="/api")         # гонки, участники гонки, зачёт
    app.include_router(stages.router, prefix="/api")        # этап: маршрут, протоколы
    app.include_router(participants.router, prefix="/api")  # карточка спортсмена

    # Новые разделы подключаем здесь, например:
    # from app.api.routes import participants
    # app.include_router(participants.router, prefix="/api/participants")

    return app


app = create_app()
