"""Выбор сезона для публичного контента и скрипта примеров."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Race


async def content_race_id(
    session: AsyncSession, race_id: int | None = None
) -> int | None:
    if race_id is not None:
        return await session.scalar(select(Race.id).where(Race.id == race_id))
    # То же правило, что у /races/current. ID устраняет неоднозначность при равном годе.
    return await session.scalar(
        select(Race.id)
        .order_by(Race.is_current.desc(), Race.year.desc(), Race.id.desc())
        .limit(1)
    )
