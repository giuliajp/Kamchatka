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

    # База данных
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://user:password@localhost:5432/avacha"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # VK
    VK_APP_ID = os.getenv("VK_APP_ID", "")
    VK_APP_SECRET = os.getenv("VK_APP_SECRET", "")

    # Iridium360 (трекинг участников) — см. app/services/iridium360/
    IRIDIUM360_API_URL = os.getenv("IRIDIUM360_API_URL", "https://www.iridium360.ru")
    IRIDIUM360_API_KEY = os.getenv("IRIDIUM360_API_KEY", "")

    # Базовый интервал опроса трекеров, секунды (по брифу — 20 минут по умолчанию,
    # но должен быть настраиваемым, а не захардкоженным)
    TRACKER_POLL_INTERVAL_SECONDS = int(os.getenv("TRACKER_POLL_INTERVAL_SECONDS", "1200"))
