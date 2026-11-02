"""
Админка: вход организаторов (задача 3.2).
Подключено в app/main.py с префиксом /api.

Остальные адреса /api/admin/... требуют заголовок Authorization: Bearer <токен из /login>.
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.api.deps import AdminDep, SessionDep
from app.models import AdminUser
from app.schemas.admin import AdminOut, LoginIn, LoginOut
from app.schemas.common import ApiResponse, ok
from app.services.admin_auth import issue_token, verify_password

router = APIRouter(prefix="/admin", tags=["Админка: вход"])


def admin_out(admin: AdminUser) -> dict:
    return {"id": admin.id, "login": admin.login, "full_name": admin.full_name}


@router.post("/login", response_model=ApiResponse[LoginOut], summary="Вход организатора")
async def login(body: LoginIn, session: SessionDep):
    admin = (await session.execute(
        select(AdminUser).where(func.lower(AdminUser.login) == body.login.strip().lower())
    )).scalar_one_or_none()
    # Одинаковый ответ для «нет такого логина» и «неверный пароль» — не подсказываем, что угадано.
    if admin is None or not admin.is_active or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token, expires_at = issue_token(admin.id)
    return ok({"token": token, "expires_at": expires_at, "admin": admin_out(admin)})


@router.get("/me", response_model=ApiResponse[AdminOut], summary="Кто вошёл")
async def me(admin: AdminDep):
    return ok(admin_out(admin))
