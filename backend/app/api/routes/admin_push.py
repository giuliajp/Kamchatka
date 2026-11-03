"""
Админка: push-рассылки (задача 3.7). Только для организаторов.

Ручная рассылка всем разрешившим уведомления или болельщикам одного участника, и журнал
всех рассылок — ручных и автоматических (старт этапа, отметка КП, протокол, смена лидера).
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import AdminDep, SessionDep
from app.models import PushMessage, RaceParticipant
from app.schemas.common import ok
from app.services import push, vk_api

router = APIRouter(prefix="/admin", tags=["Админка: push"])


class PushIn(BaseModel):
    message: str = Field(min_length=3, max_length=vk_api.MAX_MESSAGE)
    race_participant_id: int | None = Field(None, description="Пусто — всем; иначе болельщикам участника")
    fragment: str | None = Field(None, max_length=200, description="Что открыть в приложении, например results")


def push_out(p: PushMessage) -> dict:
    return {"id": p.id, "segment": p.segment, "message": p.message, "fragment": p.fragment,
            "trigger": p.trigger, "recipients": p.recipients, "delivered": p.delivered, "error": p.error,
            "created_by": p.created_by, "created_at": p.created_at}


@router.post("/push", summary="Отправить push")
async def send_push(body: PushIn, session: SessionDep, admin: AdminDep):
    segment = "all"
    if body.race_participant_id is not None:
        if await session.get(RaceParticipant, body.race_participant_id) is None:
            raise HTTPException(status_code=404, detail="Участник гонки не найден")
        segment = f"supporters:{body.race_participant_id}"
    record = await push.send(session, segment=segment, message=body.message, fragment=body.fragment,
                             trigger="manual", created_by=admin.full_name)
    await session.commit()
    return ok(push_out(record))


@router.get("/push", summary="Журнал рассылок (новые сверху)")
async def push_history(session: SessionDep, admin: AdminDep, limit: int = Query(100, ge=1, le=500)):
    items = await session.scalars(select(PushMessage).order_by(PushMessage.id.desc()).limit(limit))
    return ok([push_out(p) for p in items])
