"""
Зависимости для эндпоинтов.

    from app.api.deps import SessionDep, AdminDep, VkUserDep

    @router.get("/something")
    async def something(session: SessionDep):
        result = await session.execute(select(...))

- AdminDep        — организатор из заголовка Authorization: Bearer <токен>; иначе 401.
- VkUserDep       — id пользователя VK из подписанных параметров запуска; иначе 401.
- OptionalVkUserDep — то же, но без ошибки: None, если пользователь неизвестен.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import AdminUser
from app.services.admin_auth import read_token
from app.services.vk_auth import launch_params_user

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def current_admin(
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
) -> AdminUser:
    scheme, _, token = (authorization or "").partition(" ")
    admin_id = read_token(token.strip()) if scheme.lower() == "bearer" else None
    admin = await session.get(AdminUser, admin_id) if admin_id else None
    if admin is None or not admin.is_active:
        raise HTTPException(status_code=401, detail="Войдите в админку заново")
    return admin


AdminDep = Annotated[AdminUser, Depends(current_admin)]


def optional_vk_user(
    x_vk_launch_params: Annotated[str | None, Header()] = None,
) -> int | None:
    settings = get_settings()
    user_id = launch_params_user(x_vk_launch_params or "", settings.vk_app_secret, settings.vk_app_id)
    if user_id is None and not x_vk_launch_params and not settings.is_production:
        return settings.vk_dev_user_id
    return user_id


def required_vk_user(user_id: Annotated[int | None, Depends(optional_vk_user)]) -> int:
    if user_id is None:
        raise HTTPException(status_code=401, detail="Откройте приложение во ВКонтакте")
    return user_id


OptionalVkUserDep = Annotated[int | None, Depends(optional_vk_user)]
VkUserDep = Annotated[int, Depends(required_vk_user)]
