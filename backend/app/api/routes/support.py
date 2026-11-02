"""
«Болею за», счётчик болельщиков, рейтинг народной поддержки; отметки судей на КП
для карточки участника. Подключено в app/main.py с префиксом /api.

Кто пользователь — по подписанным параметрам запуска VK (заголовок X-VK-Launch-Params,
см. app/services/vk_auth.py). Счётчики и рейтинг видят все, без входа.
"""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import OptionalVkUserDep, SessionDep, VkUserDep
from app.api.presenters import discipline_short
from app.models import (
    CheckpointPass, Race, RaceParticipant, StageCheckpoint, SupportSubscription,
)
from app.models.base import utcnow
from app.schemas.common import ApiResponse, ok
from app.schemas.support import (
    CancelledOut, MySupport, NotificationsIn, PublicCheckpointPass, RatingItem, SupportState,
)
from app.services.support import counts_with_change

router = APIRouter(tags=["Болельщики"])


async def get_entry_or_404(session, entry_id: int) -> RaceParticipant:
    entry = await session.get(RaceParticipant, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Участник гонки не найден")
    return entry


async def active_subscription(session, user_id: int, entry_id: int) -> SupportSubscription | None:
    return (await session.execute(
        select(SupportSubscription).where(
            SupportSubscription.vk_user_id == user_id,
            SupportSubscription.race_participant_id == entry_id,
            SupportSubscription.cancelled_at.is_(None),
        )
    )).scalar_one_or_none()


async def support_state(session, entry_id: int, user_id: int | None) -> dict:
    count, change = (await counts_with_change(session, entry_ids=[entry_id])).get(entry_id, (0, 0))
    mine = await active_subscription(session, user_id, entry_id) if user_id else None
    return {"race_participant_id": entry_id, "supporters_count": count, "change_24h": change,
            "is_supported": None if user_id is None else mine is not None,
            "notifications_enabled": None if user_id is None else (mine.notifications_enabled if mine else False)}


@router.get("/race-participants/{entry_id}/support", response_model=ApiResponse[SupportState],
            summary="Сколько болельщиков у участника и болею ли я")
async def get_support(entry_id: int, session: SessionDep, user_id: OptionalVkUserDep):
    await get_entry_or_404(session, entry_id)
    return ok(await support_state(session, entry_id, user_id))


@router.put("/race-participants/{entry_id}/support", response_model=ApiResponse[SupportState],
            summary="Нажать «Болею за» (повторное нажатие ничего не меняет)")
async def add_support(entry_id: int, session: SessionDep, user_id: VkUserDep):
    await get_entry_or_404(session, entry_id)
    if await active_subscription(session, user_id, entry_id) is None:
        session.add(SupportSubscription(vk_user_id=user_id, race_participant_id=entry_id))
        try:
            await session.commit()
        except IntegrityError:          # два нажатия одновременно — вторая запись не нужна
            await session.rollback()
    return ok(await support_state(session, entry_id, user_id))


@router.delete("/race-participants/{entry_id}/support", response_model=ApiResponse[SupportState],
               summary="Отписаться от участника")
async def remove_support(entry_id: int, session: SessionDep, user_id: VkUserDep):
    await get_entry_or_404(session, entry_id)
    mine = await active_subscription(session, user_id, entry_id)
    if mine is not None:
        mine.cancelled_at = utcnow()
        await session.commit()
    return ok(await support_state(session, entry_id, user_id))


@router.get("/me/supports", response_model=ApiResponse[list[MySupport]],
            summary="За кого я болею (профиль)")
async def my_supports(session: SessionDep, user_id: VkUserDep,
                      race_id: int | None = Query(None, description="Пусто — все гонки")):
    stmt = (
        select(SupportSubscription)
        .join(RaceParticipant, RaceParticipant.id == SupportSubscription.race_participant_id)
        .where(SupportSubscription.vk_user_id == user_id, SupportSubscription.cancelled_at.is_(None))
        .options(selectinload(SupportSubscription.race_participant).selectinload(RaceParticipant.participant),
                 selectinload(SupportSubscription.race_participant).selectinload(RaceParticipant.discipline))
        .order_by(SupportSubscription.created_at)
    )
    if race_id is not None:
        stmt = stmt.where(RaceParticipant.race_id == race_id)
    items = []
    for s in (await session.execute(stmt)).scalars():
        e = s.race_participant
        items.append({"race_participant_id": e.id, "race_id": e.race_id, "start_number": e.start_number,
                      "full_name": e.participant.full_name, "photo_url": e.participant.photo_url,
                      "discipline": discipline_short(e.discipline),
                      "notifications_enabled": s.notifications_enabled, "supported_since": s.created_at})
    return ok(items)


@router.patch("/me/supports/{entry_id}", response_model=ApiResponse[SupportState],
              summary="Включить или выключить уведомления по участнику, не отписываясь")
async def set_notifications(entry_id: int, body: NotificationsIn, session: SessionDep, user_id: VkUserDep):
    mine = await active_subscription(session, user_id, entry_id)
    if mine is None:
        raise HTTPException(status_code=404, detail="Вы не болеете за этого участника")
    mine.notifications_enabled = body.notifications_enabled
    await session.commit()
    return ok(await support_state(session, entry_id, user_id))


@router.delete("/me/supports", response_model=ApiResponse[CancelledOut],
               summary="Отписаться от всех участников")
async def cancel_all(session: SessionDep, user_id: VkUserDep,
                     race_id: int | None = Query(None, description="Пусто — во всех гонках")):
    stmt = update(SupportSubscription).where(
        SupportSubscription.vk_user_id == user_id, SupportSubscription.cancelled_at.is_(None))
    if race_id is not None:
        stmt = stmt.where(SupportSubscription.race_participant_id.in_(
            select(RaceParticipant.id).where(RaceParticipant.race_id == race_id)))
    result = await session.execute(stmt.values(cancelled_at=utcnow()).execution_options(synchronize_session=False))
    await session.commit()
    return ok({"cancelled": result.rowcount})


@router.get("/races/{race_id}/support-rating", response_model=ApiResponse[list[RatingItem]],
            summary="Рейтинг народной поддержки: больше болельщиков — выше")
async def support_rating(race_id: int, session: SessionDep,
                         discipline: str | None = Query(None, description="Код дисциплины; пусто — все")):
    if await session.get(Race, race_id) is None:
        raise HTTPException(status_code=404, detail="Гонка не найдена")
    entries = (await session.execute(
        select(RaceParticipant).where(RaceParticipant.race_id == race_id)
        .options(selectinload(RaceParticipant.participant), selectinload(RaceParticipant.discipline))
    )).scalars().all()
    if discipline:
        entries = [e for e in entries if e.discipline.code == discipline]
    counts = await counts_with_change(session, race_id=race_id)
    rows = sorted(entries, key=lambda e: (-counts.get(e.id, (0, 0))[0], e.start_number))
    items, rank, previous = [], 0, None
    for index, e in enumerate(rows, start=1):
        count, change = counts.get(e.id, (0, 0))
        if count != previous:                  # равное число болельщиков — одно место
            rank, previous = index, count
        items.append({"rank": rank, "race_participant_id": e.id, "start_number": e.start_number,
                      "full_name": e.participant.full_name, "photo_url": e.participant.photo_url,
                      "discipline": discipline_short(e.discipline),
                      "supporters_count": count, "change_24h": change})
    return ok(items)


@router.get("/race-participants/{entry_id}/checkpoint-passes",
            response_model=ApiResponse[list[PublicCheckpointPass]],
            summary="Отметки судей на КП (карточка участника)")
async def public_passes(entry_id: int, session: SessionDep,
                        stage_id: int | None = Query(None, description="Пусто — все этапы")):
    await get_entry_or_404(session, entry_id)
    stmt = (
        select(CheckpointPass).where(CheckpointPass.race_participant_id == entry_id)
        .options(selectinload(CheckpointPass.stage_checkpoint).selectinload(StageCheckpoint.stage),
                 selectinload(CheckpointPass.stage_checkpoint).selectinload(StageCheckpoint.checkpoint))
    )
    if stage_id is not None:
        stmt = stmt.join(StageCheckpoint).where(StageCheckpoint.stage_id == stage_id)
    items = []
    for p in (await session.execute(stmt)).scalars():
        sc = p.stage_checkpoint
        items.append({"stage_id": sc.stage_id, "stage_number": sc.stage.number,
                      "stage_checkpoint_id": sc.id, "order_index": sc.order_index,
                      "role": sc.role.value, "label": sc.label, "name": sc.checkpoint.name,
                      "km_from_start": sc.km_from_start,
                      "required_rest_minutes": sc.required_rest_minutes,
                      "arrived_at": p.arrived_at, "departed_at": p.departed_at})
    items.sort(key=lambda i: (i["stage_number"], i["order_index"]))
    return ok(items)
