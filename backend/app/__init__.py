"""
Application factory. Здесь собирается Flask-приложение: конфигурация, расширения (БД, миграции,
CORS), обработчики ошибок, регистрация blueprint'ов (маршрутов).

Паттерн "app factory" выбран специально — удобен для тестов (можно создавать разные
инстансы приложения с разным конфигом) и не создаёт глобальный `app` объект на этапе импорта.
"""

from flask import Flask

from app.config import Config
from app.extensions import cors, db, migrate


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.json.ensure_ascii = False  # русские буквы в JSON как есть, без \u0418...

    db.init_app(app)
    # render_as_batch нужен, чтобы миграции корректно работали в SQLite
    migrate.init_app(app, db, render_as_batch=True)
    # TODO перед продакшеном: добавить в CORS_ORIGINS реальный домен VK Mini App
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Модели импортируются, чтобы миграции «видели» все таблицы
    from app import models  # noqa: F401

    # Ошибки в едином JSON-формате
    from app.middleware.errors import register_error_handlers
    register_error_handlers(app)

    # ── Маршруты ─────────────────────────────────────────────────────────
    from app.api.routes.health import bp as health_bp
    app.register_blueprint(health_bp)  # /health — без префикса, для мониторинга

    # Новые разделы регистрируем здесь по мере появления, например:
    # from app.api.routes.participants import bp as participants_bp
    # app.register_blueprint(participants_bp, url_prefix="/api/participants")

    return app
