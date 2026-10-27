"""
Шаблон нового раздела API. Скопируйте этот файл (например, в faq.py)
и поменяйте tags и функции.

Подключить в app/main.py:
    from app.api.routes import faq
    app.include_router(faq.router, prefix="/api/faq")

Правила:
- Ответы — через ok() и ApiResponse[...] из app/schemas/common.py.
- Ошибки — raise HTTPException(status_code=404, detail="Не найдено").
- Внутри async-функций — только асинхронные операции (await session.execute(...), httpx).
  Никаких requests, time.sleep и долгих вычислений — они остановят сервер для всех.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.schemas.common import ApiResponse, ok

router = APIRouter(tags=["Шаблон"])


class PingData(BaseModel):
    message: str


@router.get("/ping", response_model=ApiResponse[PingData], summary="Пример эндпоинта")
async def ping():
    return ok({"message": "pong"})
