"""
Конфигурация приложения. Значения берутся из переменных окружения / файла .env (не коммитится).

Секреты (API-ключ Iridium360, данные для БД, VK-приложения) храним только в .env,
никогда — в коде и в git.

Использование:
    from app.config import get_settings
    settings = get_settings()
    settings.database_url
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    secret_key: str = "dev-secret-change-me"

    # База данных. По умолчанию — локальный файл SQLite (backend/instance/avacha.db).
    # На сервере в .env указывается postgresql+asyncpg://...
    database_url: str = "sqlite+aiosqlite:///./instance/avacha.db"

    # С каких адресов фронтенду можно обращаться к API (через запятую)
    cors_origins: str = "http://localhost:5173"

    # VK
    vk_app_id: str = ""
    vk_app_secret: str = ""

    # Iridium360 (трекинг участников) — см. app/services/iridium360/
    iridium360_api_url: str = "https://www.iridium360.ru"
    iridium360_api_key: str = ""

    # Как часто наш бэкенд опрашивает Iridium360, секунды.
    # Это НЕ интервал передачи точек трекером (20 мин по брифу) — тот хранится в БД
    # в Season.tracking_interval_minutes и может переопределяться на этапе (Stage).
    # Подходящее значение уточним при разборе API Iridium360 (задача 1.4).
    tracker_poll_interval_seconds: int = 1200

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Настройки читаются один раз и дальше берутся из памяти."""
    return Settings()
