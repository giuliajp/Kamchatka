"""
Единый формат ответов API.

Успех:   {"data": <данные>, "error": null}
Ошибка:  {"data": null, "error": {"code": "not_found", "message": "...", "details": null}}

В эндпоинте:
    @router.get("/faq", response_model=ApiResponse[list[FaqItem]])
    async def list_faq(...):
        return ok(items)
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorInfo(BaseModel):
    code: str                 # короткое имя для программы (фронтенд проверяет его)
    message: str              # текст для человека
    details: Any | None = None  # подробности (например, какие поля заполнены неверно)


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: ErrorInfo | None = None


def ok(data: Any = None) -> dict:
    """Успешный ответ."""
    return {"data": data, "error": None}
