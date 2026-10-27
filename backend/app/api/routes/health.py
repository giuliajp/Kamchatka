"""
Проверка, что сервис жив и база данных доступна. Полезно для мониторинга/деплоя.
Открыть в браузере: http://127.0.0.1:8000/health
"""

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import SessionDep
from app.config import get_settings
from app.middleware.errors import error_response
from app.schemas.common import ApiResponse, ok
from app.schemas.health import HealthData

router = APIRouter(tags=["Служебное"])


@router.get(
    "/health",
    response_model=ApiResponse[HealthData],
    summary="Проверка сервиса и базы данных",
    responses={503: {"description": "База данных недоступна"}},
)
async def health_check(session: SessionDep):
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        return error_response(503, "database_unavailable", "База данных недоступна")
    return ok({"status": "ok", "database": "ok", "env": get_settings().environment})
