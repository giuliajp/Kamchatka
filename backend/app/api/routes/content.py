"""
Публичный контент: программа фестиваля, FAQ и зрительские локации (задача 2.7).

Подключено в app/main.py с префиксом /api. Выдаём только опубликованные записи.
Пустой раздел — успешный ответ с пустым списком.
"""

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.models import FaqItem, ProgramEvent, SpectatorLocation
from app.schemas.common import ApiResponse, ok
from app.schemas.content import FaqItemOut, ProgramEventOut, SpectatorLocationOut

router = APIRouter(tags=["Контент"])


@router.get("/program", response_model=ApiResponse[list[ProgramEventOut]],
            summary="Программа фестиваля по времени начала")
async def list_program(session: SessionDep):
    events = (await session.execute(
        select(ProgramEvent)
        .where(ProgramEvent.is_published.is_(True))
        .options(selectinload(
            ProgramEvent.location.and_(SpectatorLocation.is_published.is_(True))
        ))
        .order_by(ProgramEvent.start_at, ProgramEvent.sort_order, ProgramEvent.id)
    )).scalars().all()
    return ok(events)


@router.get("/faq", response_model=ApiResponse[list[FaqItemOut]],
            summary="Частые вопросы и ответы по порядку")
async def list_faq(session: SessionDep):
    items = (await session.execute(
        select(FaqItem)
        .where(FaqItem.is_published.is_(True))
        .order_by(FaqItem.sort_order, FaqItem.id)
    )).scalars().all()
    return ok(items)


@router.get("/locations", response_model=ApiResponse[list[SpectatorLocationOut]],
            summary="Зрительские локации по порядку")
async def list_locations(session: SessionDep):
    locations = (await session.execute(
        select(SpectatorLocation)
        .where(SpectatorLocation.is_published.is_(True))
        .order_by(SpectatorLocation.sort_order, SpectatorLocation.id)
    )).scalars().all()
    return ok(locations)
