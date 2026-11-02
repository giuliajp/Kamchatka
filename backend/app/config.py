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
from pathlib import Path

from sqlalchemy import URL

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,   # пустая строка в .env = значение по умолчанию
    )

    environment: str = "development"
    secret_key: str = "dev-secret-change-me"

    # PostgreSQL: общие настройки с Docker Compose из backend/.env.
    postgres_db: str
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int

    @property
    def database_url(self) -> str:
        return URL.create(
            "postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    # С каких адресов фронтенду можно обращаться к API (через запятую)
    cors_origins: str = "http://localhost:5173"

    # VK. vk_app_secret — «Защищённый ключ» из настроек мини-приложения:
    # им проверяем подпись параметров запуска (кто открыл приложение).
    vk_app_id: str = ""
    vk_app_secret: str = ""
    # Только для локальной разработки без VK: этот id считается пользователем,
    # если запрос пришёл без параметров запуска. В production не действует.
    vk_dev_user_id: int | None = None

    # Админка: сколько часов действует вход организатора.
    admin_token_ttl_hours: int = 12

    # Iridium360 (трекинг участников) — см. app/services/iridium360/
    iridium360_api_url: str = "https://api.iridium360.ru"
    iridium360_api_key: str = ""

    # Как часто наш бэкенд опрашивает Iridium360, секунды.
    # Это НЕ интервал передачи точек трекером (20 мин по брифу) — тот хранится в БД
    # в Season.tracking_interval_minutes и может переопределяться на этапе (Stage).
    # Iridium отдаёт последние точки всех устройств одним запросом, поэтому опрашиваем часто:
    # новая точка появляется на карте не позже чем через 2 минуты после прихода в Iridium.
    tracker_poll_interval_seconds: int = 120
    # Выключатель фонового опроса (например, для второго экземпляра сервера).
    tracker_polling_enabled: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Настройки читаются один раз и дальше берутся из памяти."""
    return Settings()
