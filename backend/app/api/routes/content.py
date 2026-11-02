"""
Публичный контент: программа фестиваля, FAQ и зрительские локации (задача 2.7).

Подключено в app/main.py с префиксом /api. Выдаём только опубликованные записи.
Пустой раздел — успешный ответ с пустым списком.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.models import (
    FaqItem,
    LocationType,
    OrganizerContact,
    ProgramEvent,
    ProgramEventType,
    SpectatorLocation,
)
from app.schemas.common import ApiResponse, ok
from app.schemas.content import (
    FaqItemOut,
    OrganizerContactOut,
    ProgramEventOut,
    SpectatorLocationOut,
)
from app.services.content import content_race_id

router = APIRouter(tags=["Контент"])


@router.get(
    "/program",
    response_model=ApiResponse[list[ProgramEventOut]],
    summary="Программа фестиваля по времени начала",
)
async def list_program(
    session: SessionDep,
    race_id: Annotated[int | None, Query(gt=0)] = None,
    event_type: Annotated[ProgramEventType | None, Query(alias="type")] = None,
):
    selected_race = await content_race_id(session, race_id)
    if selected_race is None:
        if race_id is not None:
            raise HTTPException(status_code=404, detail="Гонка не найдена")
        return ok([])
    conditions = [
        ProgramEvent.is_published.is_(True),
        ProgramEvent.race_id == selected_race,
    ]
    if event_type is not None:
        conditions.append(ProgramEvent.event_type == event_type)
    events = (
        (
            await session.execute(
                select(ProgramEvent)
                .where(*conditions)
                .options(
                    selectinload(
                        ProgramEvent.location.and_(
                            SpectatorLocation.is_published.is_(True),
                            SpectatorLocation.race_id == selected_race,
                        )
                    )
                )
                .order_by(
                    ProgramEvent.start_at, ProgramEvent.sort_order, ProgramEvent.id
                )
            )
        )
        .scalars()
        .all()
    )
    return ok(events)


@router.get(
    "/faq",
    response_model=ApiResponse[list[FaqItemOut]],
    summary="Частые вопросы и ответы по порядку",
)
async def list_faq(session: SessionDep):
    items = (
        (
            await session.execute(
                select(FaqItem)
                .where(FaqItem.is_published.is_(True))
                .order_by(FaqItem.sort_order, FaqItem.id)
            )
        )
        .scalars()
        .all()
    )
    return ok(items)


@router.get(
    "/locations",
    response_model=ApiResponse[list[SpectatorLocationOut]],
    summary="Зрительские локации по порядку",
)
async def list_locations(
    session: SessionDep,
    race_id: Annotated[int | None, Query(gt=0)] = None,
    location_type: Annotated[LocationType | None, Query(alias="type")] = None,
):
    selected_race = await content_race_id(session, race_id)
    if selected_race is None:
        if race_id is not None:
            raise HTTPException(status_code=404, detail="Гонка не найдена")
        return ok([])
    conditions = [
        SpectatorLocation.is_published.is_(True),
        SpectatorLocation.race_id == selected_race,
    ]
    if location_type is not None:
        conditions.append(SpectatorLocation.location_type == location_type)
    locations = (
        (
            await session.execute(
                select(SpectatorLocation)
                .where(*conditions)
                .order_by(SpectatorLocation.sort_order, SpectatorLocation.id)
            )
        )
        .scalars()
        .all()
    )
    return ok(locations)


@router.get(
    "/contacts",
    response_model=ApiResponse[list[OrganizerContactOut]],
    summary="Опубликованные контакты организаторов",
)
async def list_contacts(session: SessionDep):
    contacts = (
        (
            await session.execute(
                select(OrganizerContact)
                .where(OrganizerContact.is_published.is_(True))
                .order_by(OrganizerContact.sort_order, OrganizerContact.id)
            )
        )
        .scalars()
        .all()
    )
    return ok(contacts)
