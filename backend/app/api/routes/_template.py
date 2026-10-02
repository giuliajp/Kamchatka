"""
Шаблон blueprint'а. Скопируйте этот файл (например, в faq.py, participants.py, results.py)
и переименуйте bp, чтобы начать новый раздел API.

Подключить в app/__init__.py:
    from app.api.routes.faq import bp as faq_bp
    app.register_blueprint(faq_bp, url_prefix="/api/faq")

Ответы — только через ok() и error() из app/api/responses.py, чтобы фронтенд
всегда получал одинаковый формат.
"""

from flask import Blueprint

from app.api.responses import error, ok  # noqa: F401

bp = Blueprint("_template", __name__)


@bp.get("/ping")
def ping():
    return ok({"message": "pong"})
