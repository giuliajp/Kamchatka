"""
Ошибки в едином JSON-формате {"data": null, "error": {...}}.

Чтобы вернуть ошибку из эндпоинта:
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Участник не найден")
    raise HTTPException(status_code=422, detail={"message": "...", "details": ["строка 5: ..."]})
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("avacha")

# Короткие коды и русские тексты для частых ошибок.
ERRORS = {
    400: ("bad_request", "Некорректный запрос"),
    401: ("unauthorized", "Требуется авторизация"),
    403: ("forbidden", "Доступ запрещён"),
    404: ("not_found", "Не найдено"),
    409: ("conflict", "Конфликт с текущими данными"),
    405: ("method_not_allowed", "Этот метод не поддерживается для данного адреса"),
    422: ("validation_error", "Данные заполнены неверно"),
    429: ("too_many_requests", "Слишком много запросов, попробуйте позже"),
    503: ("service_unavailable", "Сервис временно недоступен"),
}


def error_response(status: int, code: str, message: str, details=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"data": None, "error": {"code": code, "message": message, "details": details}},
    )


def register_error_handlers(app: FastAPI) -> None:

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException):
        code, default_message = ERRORS.get(exc.status_code, ("error", "Ошибка"))
        # detail={"message": "...", "details": [...]} — ошибка со списком подробностей
        # (например, все ошибочные строки загруженного протокола).
        if isinstance(exc.detail, dict):
            return error_response(exc.status_code, code, exc.detail.get("message", default_message),
                                  exc.detail.get("details"))
        # Стандартные английские тексты заменяем русскими, свои (из detail) оставляем.
        message = exc.detail if isinstance(exc.detail, str) and exc.detail not in (
            "Not Found", "Method Not Allowed",
        ) else default_message
        return error_response(exc.status_code, code, message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        # Какие поля неверны — в details, чтобы фронтенд мог подсветить их.
        details = [
            {"field": ".".join(str(p) for p in err["loc"][1:]), "problem": err["msg"]}
            for err in exc.errors()
        ]
        code, message = ERRORS[422]
        return error_response(422, code, message, details)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        # Непредвиденная ошибка в коде: пишем в лог, пользователю — без подробностей.
        logger.exception("Необработанная ошибка: %s", exc)
        return error_response(500, "internal_error", "Внутренняя ошибка сервера")
