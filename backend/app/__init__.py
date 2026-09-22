"""
Application factory. Здесь собирается Flask-приложение: конфигурация, расширения (БД, CORS),
регистрация blueprint'ов (маршрутов).

Паттерн "app factory" выбран специально — удобен для тестов (можно создавать разные
инстансы приложения с разным конфигом) и не создаёт глобальный `app` объект на этапе импорта.
"""

from flask import Flask, jsonify

from app.config import Config
from app.extensions import cors, db


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    cors.init_app(app)  # TODO: сузить origins до реального домена VK Mini App перед продакшеном

    @app.get("/health")
    def health_check():
        """Проверка, что сервис жив. Полезно для мониторинга/деплоя."""
        return jsonify(status="ok", env=app.config.get("ENVIRONMENT"))

    # TODO: регистрировать blueprint'ы по мере появления, например:
    # from app.api.routes.map import bp as map_bp
    # from app.api.routes.participants import bp as participants_bp
    # from app.api.routes.results import bp as results_bp
    # app.register_blueprint(map_bp, url_prefix="/api/map")
    # app.register_blueprint(participants_bp, url_prefix="/api/participants")
    # app.register_blueprint(results_bp, url_prefix="/api/results")

    return app
