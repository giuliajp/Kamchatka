"""
Сборка приложения FastAPI: настройки, CORS, обработчики ошибок, маршруты.

Запуск: python backend/run.py (из корня репозитория).
Документация API — автоматически: http://127.0.0.1:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.config import get_settings
from app.db import engine
from app.middleware.errors import register_error_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
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

    return app


app = create_app()
