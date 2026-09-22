"""
Шаблон blueprint'а. Скопируйте этот файл (например, в map.py, participants.py, results.py)
и переименуйте bp, чтобы начать новый раздел API.

Подключить в app/__init__.py:
    from app.api.routes.map import bp as map_bp
    app.register_blueprint(map_bp, url_prefix="/api/map")
"""

from flask import Blueprint, jsonify

bp = Blueprint("_template", __name__)


@bp.get("/ping")
def ping():
    return jsonify(message="pong")
