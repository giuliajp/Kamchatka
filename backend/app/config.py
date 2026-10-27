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
        extra="ignore"
    )

    environment: str = "development"

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

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Настройки читаются один раз и дальше берутся из памяти."""
    return Settings()
