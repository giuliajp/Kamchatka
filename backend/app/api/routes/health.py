"""
Проверка, что сервис жив и база данных доступна. Полезно для мониторинга/деплоя.
Открыть в браузере: http://127.0.0.1:8000/health
"""
from flask import Blueprint, current_app
from sqlalchemy import text

from app.api.responses import error, ok
from app.extensions import db

bp = Blueprint("health", __name__)


@bp.get("/health")
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        return error("database_unavailable", "База данных недоступна", 503)
    return ok({"status": "ok", "database": "ok", "env": current_app.config.get("ENVIRONMENT")})
