"""
Новости и фото из сообщества VK, «Сохранённые материалы», учёт пользователей для push.

- Новости — карточка-анонс (заголовок, обложка, дата, первые строки). Полный текст
  открывается во VK по owner_id и post_id; «Поделиться» — репост исходной записи (VK Bridge).
- Фото — из альбома сообщества (VK_PHOTO_ALBUM_ID), сгруппированы по дням по Камчатке.
- Ответы VK держим в памяти VK_CACHE_SECONDS. Если VK недоступен — отдаём последнее,
  что получили (с пометкой stale), а не пустой экран.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.api.deps import SessionDep, VkUserDep
from app.config import get_settings
from app.models import AppUser, Bookmark, EventReminder, Participant, ProgramEvent, RaceParticipant
from app.models.base import utcnow
from app.schemas.common import ok
from app.services import vk_api

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Новости, фото, профиль"])
KAMCHATKA = timezone(timedelta(hours=12))
PREVIEW_CHARS = 280

_cache: dict[str, tuple[float, Any]] = {}


async def cached(key: str, loader) -> tuple[Any, bool]:
    """(данные, устарели ли). Ошибка VK при наличии старых данных — отдаём старые."""
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and now - hit[0] < get_settings().vk_cache_seconds:
        return hit[1], False
    try:
        data = await loader()
    except vk_api.VkApiError:
        if hit:
            return hit[1], True
        raise HTTPException(status_code=503, detail="Новости VK временно недоступны, попробуйте позже") from None
    _cache[key] = (now, data)
    return data, False


def group_owner() -> int:
    group_id = get_settings().vk_group_id
    if not group_id:
        logger.warning("VK media unavailable: VK_GROUP_ID is not configured")
        raise HTTPException(status_code=503, detail="Материалы VK временно недоступны. Попробуйте позже")
    return -abs(group_id)


def biggest(sizes: list[dict]) -> str | None:
    best = max(sizes or [], key=lambda s: (s.get("width") or 0) * (s.get("height") or 0), default=None)
    return best.get("url") if best else None


def cover_of(post: dict) -> str | None:
    for attachment in post.get("attachments") or []:
        kind = attachment.get("type")
        if kind == "photo":
            return biggest(attachment["photo"].get("sizes"))
        if kind == "video":
            images = attachment["video"].get("image") or []
            return biggest(images)
        if kind == "link" and attachment["link"].get("photo"):
            return biggest(attachment["link"]["photo"].get("sizes"))
    return None


def news_item(post: dict) -> dict:
    text = (post.get("text") or "").strip()
    if not text and post.get("copy_history"):
        text = (post["copy_history"][0].get("text") or "").strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0][:150] if lines else ""
    rest = " ".join(lines[1:])
    preview = rest[:PREVIEW_CHARS] + ("…" if len(rest) > PREVIEW_CHARS else "")
    owner, post_id = post["owner_id"], post["id"]
    return {"id": f"{owner}_{post_id}", "owner_id": owner, "post_id": post_id,
            "date": datetime.fromtimestamp(post["date"], tz=timezone.utc),
            "title": title, "preview": preview, "cover_url": cover_of(post),
            "is_pinned": bool(post.get("is_pinned")),
            "url": f"https://vk.com/wall{owner}_{post_id}",
            "likes": (post.get("likes") or {}).get("count"), "reposts": (post.get("reposts") or {}).get("count")}


@router.get("/news", summary="Новости сообщества гонки (карточки-анонсы)")
async def news(offset: int = Query(0, ge=0, le=1000), count: int = Query(20, ge=1, le=50)):
    owner = group_owner()
    data, stale = await cached(f"news:{offset}:{count}", lambda: vk_api.call(
        "wall.get", owner_id=owner, offset=offset, count=count, filter="owner"))
    items = [news_item(p) for p in (data or {}).get("items", []) if p.get("post_type", "post") == "post"]
    return ok({"items": items, "total": (data or {}).get("count", 0), "stale": stale})


@router.get("/photos/albums", summary="Альбомы сообщества (архив: «Берингия. Авача-2026. Первый этап»…)")
async def albums():
    owner = group_owner()
    data, stale = await cached("albums", lambda: vk_api.call("photos.getAlbums", owner_id=owner, need_covers=1))
    items = [{"id": a["id"], "title": a.get("title"), "size": a.get("size"), "cover_url": a.get("thumb_src"),
              "url": f"https://vk.com/album{owner}_{a['id']}"} for a in (data or {}).get("items", [])]
    return ok({"items": items, "stale": stale})


@router.get("/photos", summary="Фотогалерея по дням гонки (по Камчатке)")
async def photos(count: int = Query(200, ge=1, le=1000),
                 album_id: str | None = Query(None, description="Номер альбома; пусто — альбом из настроек")):
    owner = group_owner()
    album = album_id or get_settings().vk_photo_album_id
    if not (album.isdigit() or album in ("wall", "profile")):
        raise HTTPException(status_code=422, detail="Неверный альбом")
    data, stale = await cached(f"photos:{album}:{count}", lambda: vk_api.call(
        "photos.get", owner_id=owner, album_id=album, rev=1, count=count))
    days: dict[str, list[dict]] = {}
    for p in (data or {}).get("items", []):
        taken = datetime.fromtimestamp(p["date"], tz=timezone.utc)
        day = taken.astimezone(KAMCHATKA).date().isoformat()
        days.setdefault(day, []).append({
            "id": f"{p['owner_id']}_{p['id']}", "date": taken, "text": p.get("text") or None,
            "url": biggest(p.get("sizes")), "vk_url": f"https://vk.com/photo{p['owner_id']}_{p['id']}"})
    return ok({"days": [{"date": d, "photos": items} for d, items in sorted(days.items(), reverse=True)],
               "stale": stale})


# ── Пользователь приложения ────────────────────────────────────────────

class NotificationsAllowed(BaseModel):
    allowed: bool


async def save_user(session, user_id: int, allowed: bool | None) -> None:
    values = {"vk_user_id": user_id, "last_seen_at": utcnow()}
    if allowed is not None:
        values["notifications_allowed"] = allowed
    stmt = insert(AppUser).values(**values)
    await session.execute(stmt.on_conflict_do_update(
        index_elements=[AppUser.vk_user_id], set_={k: stmt.excluded[k] for k in values if k != "vk_user_id"}))
    await session.commit()


@router.post("/me/visit", summary="Отметить запуск приложения (вызывать при старте)")
async def visit(session: SessionDep, user_id: VkUserDep,
                x_vk_launch_params: str | None = Header(None)):
    params = dict(parse_qsl((x_vk_launch_params or "").lstrip("?")))
    flag = params.get("vk_are_notifications_enabled")
    await save_user(session, user_id, None if flag is None else flag == "1")
    return ok({"vk_user_id": user_id})


@router.put("/me/notifications", summary="Пользователь разрешил или запретил уведомления в приложении")
async def set_notifications(body: NotificationsAllowed, session: SessionDep, user_id: VkUserDep):
    await save_user(session, user_id, body.allowed)
    return ok({"notifications_allowed": body.allowed})


class NotificationSettings(BaseModel):
    checkpoints: bool | None = Field(None, description="«Прохождение КП» — отметки судей у моих участников")
    results: bool | None = Field(None, description="«Финиш и итоги» — протоколы этапов и смена лидера")
    news: bool | None = Field(None, description="«Новости организаторов» — старт этапа, изменения программы")


def settings_out(user: AppUser | None) -> dict:
    return {"notifications_allowed": bool(user and user.notifications_allowed),
            "checkpoints": True if user is None else user.notify_checkpoints,
            "results": True if user is None else user.notify_results,
            "news": True if user is None else user.notify_news}


@router.get("/me/notification-settings", summary="Переключатели push в профиле")
async def get_notification_settings(session: SessionDep, user_id: VkUserDep):
    return ok(settings_out(await session.get(AppUser, user_id)))


@router.put("/me/notification-settings", summary="Изменить переключатели push (передавайте только изменённые)")
async def set_notification_settings(body: NotificationSettings, session: SessionDep, user_id: VkUserDep):
    columns = {f"notify_{k}": v for k, v in body.model_dump(exclude_none=True).items()}
    stmt = insert(AppUser).values(vk_user_id=user_id, last_seen_at=utcnow(), **columns)
    if columns:
        stmt = stmt.on_conflict_do_update(index_elements=[AppUser.vk_user_id],
                                          set_={k: stmt.excluded[k] for k in columns})
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=[AppUser.vk_user_id])
    await session.execute(stmt)
    await session.commit()
    user = await session.get(AppUser, user_id)
    await session.refresh(user)
    return ok(settings_out(user))


# ── Мой профиль: «Мой результат» и напоминания ─────────────────────────

@router.get("/me", summary="Кто я: если я участник гонки — мои заявки (для «Мой результат»)")
async def me(session: SessionDep, user_id: VkUserDep):
    person = await session.scalar(select(Participant).where(Participant.vk_user_id == user_id))
    entries = []
    if person is not None:
        entries = [{"race_participant_id": e.id, "race_id": e.race_id, "start_number": e.start_number}
                   for e in await session.scalars(select(RaceParticipant).where(
                       RaceParticipant.participant_id == person.id).order_by(RaceParticipant.race_id.desc()))]
    return ok({"vk_user_id": user_id, "participant_id": person.id if person else None,
               "race_entries": entries})


@router.get("/me/reminders", summary="События, о которых я попросил напомнить")
async def my_reminders(session: SessionDep, user_id: VkUserDep):
    ids = await session.scalars(select(EventReminder.program_event_id).where(EventReminder.vk_user_id == user_id))
    return ok({"program_event_ids": sorted(ids)})


@router.put("/program/{event_id}/reminder",
            summary="Колокольчик: напомнить о событии (push за REMINDER_MINUTES_BEFORE минут)")
async def add_reminder(event_id: int, session: SessionDep, user_id: VkUserDep):
    event = await session.get(ProgramEvent, event_id)
    if event is None or not event.is_published:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    stmt = insert(EventReminder).values(vk_user_id=user_id, program_event_id=event_id, created_at=utcnow())
    await session.execute(stmt.on_conflict_do_nothing(constraint="uq_event_reminders_user_event"))
    await session.commit()
    return ok({"program_event_id": event_id, "reminder": True,
               "minutes_before": get_settings().reminder_minutes_before})


@router.delete("/program/{event_id}/reminder", summary="Убрать напоминание")
async def remove_reminder(event_id: int, session: SessionDep, user_id: VkUserDep):
    await session.execute(delete(EventReminder).where(
        EventReminder.vk_user_id == user_id, EventReminder.program_event_id == event_id))
    await session.commit()
    return ok({"program_event_id": event_id, "reminder": False})


# ── Закладки ───────────────────────────────────────────────────────────

class BookmarkIn(BaseModel):
    kind: str = Field(pattern=r"^(news|photo|protocol)$")
    item_id: str = Field(description="news, photo — как в ответе /news или /photos («-123_456»); "
                                     "protocol — «stage:<id этапа>» или «race:<id гонки>»")
    title: str | None = Field(None, max_length=300)
    url: str | None = Field(None, max_length=1000, description="Для протокола — ссылка на PDF")
    image_url: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def check_item(self) -> "BookmarkIn":
        pattern = r"^(stage|race):\d+$" if self.kind == "protocol" else r"^-?\d+_\d+$"
        if not re.fullmatch(pattern, self.item_id):
            raise ValueError("Неверный item_id для этого вида материала")
        if self.kind == "protocol" and not self.url:
            raise ValueError("Для протокола нужна ссылка на файл")
        return self


def bookmark_out(b: Bookmark) -> dict:
    return {"kind": b.kind, "item_id": b.item_id, "title": b.title, "url": b.url, "image_url": b.image_url,
            "created_at": b.created_at}


@router.get("/me/bookmarks", summary="Сохранённые материалы")
async def list_bookmarks(session: SessionDep, user_id: VkUserDep):
    items = await session.scalars(select(Bookmark).where(Bookmark.vk_user_id == user_id)
                                  .order_by(Bookmark.created_at.desc(), Bookmark.id.desc()))
    return ok([bookmark_out(b) for b in items])


@router.put("/me/bookmarks", summary="Сохранить новость или фото (повтор ничего не меняет)")
async def add_bookmark(body: BookmarkIn, session: SessionDep, user_id: VkUserDep):
    stmt = insert(Bookmark).values(vk_user_id=user_id, created_at=utcnow(), **body.model_dump())
    await session.execute(stmt.on_conflict_do_nothing(constraint="uq_bookmarks_user_item"))
    await session.commit()
    item = await session.scalar(select(Bookmark).where(
        Bookmark.vk_user_id == user_id, Bookmark.kind == body.kind, Bookmark.item_id == body.item_id))
    return ok(bookmark_out(item))


@router.delete("/me/bookmarks/{kind}/{item_id}", summary="Убрать из сохранённых")
async def delete_bookmark(kind: str, item_id: str, session: SessionDep, user_id: VkUserDep):
    result = await session.execute(delete(Bookmark).where(
        Bookmark.vk_user_id == user_id, Bookmark.kind == kind, Bookmark.item_id == item_id))
    await session.commit()
    return ok({"deleted": result.rowcount})
