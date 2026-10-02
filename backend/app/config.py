"""
Конфигурация приложения. Значения берутся из переменных окружения (файл .env, не коммитится).

Секреты (API-ключ Iridium360, данные для БД, VK-приложения) храним только здесь, в .env,
никогда — в коде и в git.
"""

import os

from dotenv import load_dotenv

load_dotenv()  # подхватывает .env, если он есть рядом


class Config:
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # База данных. По умолчанию — локальный файл SQLite (backend/instance/avacha.db).
    # На сервере в .env указывается PostgreSQL.
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///avacha.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # С каких адресов фронтенду можно обращаться к /api/*
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]

    # VK
    VK_APP_ID = os.getenv("VK_APP_ID", "")
    VK_APP_SECRET = os.getenv("VK_APP_SECRET", "")

    # Iridium360 (трекинг участников) — см. app/services/iridium360/
    IRIDIUM360_API_URL = os.getenv("IRIDIUM360_API_URL", "https://www.iridium360.ru")
    IRIDIUM360_API_KEY = os.getenv("IRIDIUM360_API_KEY", "")

    # Как часто наш бэкенд опрашивает Iridium360, секунды.
    # Это НЕ интервал передачи точек трекером (20 мин по брифу) — тот хранится в БД
    # в Season.tracking_interval_minutes и может переопределяться на этапе (Stage).
    # Подходящее значение уточним при разборе API Iridium360 (задача 1.4).
    TRACKER_POLL_INTERVAL_SECONDS = int(os.getenv("TRACKER_POLL_INTERVAL_SECONDS", "1200"))


class TestingConfig(Config):
    """Для тестов: отдельная временная база в памяти."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
