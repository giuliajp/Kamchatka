"""
Зависимости для эндпоинтов.

    from app.api.deps import SessionDep

    @router.get("/something")
    async def something(session: SessionDep):
        result = await session.execute(select(...))
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session

SessionDep = Annotated[AsyncSession, Depends(get_session)]
