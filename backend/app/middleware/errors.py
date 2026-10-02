"""
Ошибки в едином JSON-формате. Без этого Flask отдаёт ошибки HTML-страницей,
а фронтенду нужен JSON.
"""
from flask import Flask
from werkzeug.exceptions import HTTPException

from app.api.responses import error
from app.extensions import db

# тексты для частых ошибок
MESSAGES = {
    400: "Некорректный запрос",
    401: "Требуется авторизация",
    403: "Доступ запрещён",
    404: "Не найдено",
    405: "Этот метод не поддерживается для данного адреса",
    429: "Слишком много запросов, попробуйте позже",
}


def register_error_handlers(app: Flask) -> None:

    @app.errorhandler(HTTPException)
    def handle_http_error(exc: HTTPException):
        # 404 «не найдено», 405 «метод не разрешён» и т. п.
        status = exc.code or 500
        code = (exc.name or "error").lower().replace(" ", "_")
        message = MESSAGES.get(status, exc.description or exc.name)
        return error(code, message, status)

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        # Непредвиденная ошибка в коде: откатываем незавершённые изменения
        # в базе и не показываем пользователю внутренние подробности.
        db.session.rollback()
        app.logger.exception("Необработанная ошибка: %s", exc)
        if app.debug or app.testing:
            raise exc
        return error("internal_error", "Внутренняя ошибка сервера", 500)
