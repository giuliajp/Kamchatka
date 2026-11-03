"""
Админка: контент приложения — программа, зрительские локации, FAQ, контакты.
Только для организаторов. Новые записи — черновики, в приложении появятся после
is_published = true. Время — с часовым поясом, хранится в UTC.
"""


from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import AwareDatetime, BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminDep, SessionDep
from app.models import (
    FaqItem, GuestInfoItem, LocationType, OrganizerContact, ProgramEvent, ProgramEventType, Race, SpectatorLocation, Stage,
)
from app.schemas.common import ok

router = APIRouter(prefix="/admin", tags=["Админка: контент"])


def apply(item, data: dict) -> None:
    for field, value in data.items():
        if isinstance(value, datetime) and value.tzinfo is not None:
            value = value.astimezone(UTC)
        if field == "image_urls" and value is not None:
            value = [str(url) for url in value]
        setattr(item, field, value)


def plain(item, fields: list[str]) -> dict:
    out = {}
    for field in fields:
        value = getattr(item, field)
        out[field] = value.value if hasattr(value, "value") else value
    return out


async def save(session, message: str) -> None:
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=422, detail=message) from None


async def check_links(session, race_id: int, stage_id: int | None, location_id: int | None = None) -> None:
    if await session.get(Race, race_id) is None:
        raise HTTPException(status_code=404, detail="Гонка не найдена")
    if stage_id is not None:
        stage = await session.get(Stage, stage_id)
        if stage is None or stage.race_id != race_id:
            raise HTTPException(status_code=422, detail="Этап не из этой гонки")
    if location_id is not None:
        location = await session.get(SpectatorLocation, location_id)
        if location is None or location.race_id != race_id:
            raise HTTPException(status_code=422, detail="Локация не из этой гонки")


async def get_or_404(session, model, item_id: int):
    item = await session.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return item


# ── Зрительские локации ────────────────────────────────────────────────

LOCATION_FIELDS = ["id", "race_id", "stage_id", "location_type", "name", "description", "latitude", "longitude",
                   "address", "how_to_get_there", "image_urls", "sort_order", "is_published"]


class LocationIn(BaseModel):
    race_id: int
    stage_id: int | None = None
    location_type: LocationType
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str | None = Field(None, max_length=500)
    how_to_get_there: str | None = None
    image_urls: list[HttpUrl] = Field(default_factory=list, max_length=20)
    sort_order: int = Field(0, ge=0)
    is_published: bool = False


class LocationPatch(BaseModel):
    stage_id: int | None = None
    location_type: LocationType | None = None
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    address: str | None = Field(None, max_length=500)
    how_to_get_there: str | None = None
    image_urls: list[HttpUrl] | None = Field(None, max_length=20)
    sort_order: int | None = Field(None, ge=0)
    is_published: bool | None = None


@router.get("/races/{race_id}/locations", summary="Локации гонки, включая черновики")
async def list_locations(race_id: int, session: SessionDep, admin: AdminDep):
    items = await session.scalars(select(SpectatorLocation).where(SpectatorLocation.race_id == race_id)
                                  .order_by(SpectatorLocation.sort_order, SpectatorLocation.id))
    return ok([plain(i, LOCATION_FIELDS) for i in items])


@router.post("/locations", status_code=201, summary="Новая локация")
async def create_location(body: LocationIn, session: SessionDep, admin: AdminDep):
    await check_links(session, body.race_id, body.stage_id)
    item = SpectatorLocation()
    apply(item, body.model_dump())
    session.add(item)
    await save(session, "Локация не сохранена: проверьте этап и координаты")
    return ok(plain(item, LOCATION_FIELDS))


@router.patch("/locations/{item_id}", summary="Изменить локацию")
async def patch_location(item_id: int, body: LocationPatch, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, SpectatorLocation, item_id)
    data = body.model_dump(exclude_unset=True)
    if "stage_id" in data:
        await check_links(session, item.race_id, data["stage_id"])
    apply(item, data)
    await save(session, "Локация не сохранена: проверьте этап и координаты")
    return ok(plain(item, LOCATION_FIELDS))


@router.delete("/locations/{item_id}", summary="Удалить локацию (события останутся без места)")
async def delete_location(item_id: int, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, SpectatorLocation, item_id)
    out = plain(item, LOCATION_FIELDS)
    await session.delete(item)
    await session.commit()
    return ok(out)


# ── Программа ──────────────────────────────────────────────────────────

EVENT_FIELDS = ["id", "race_id", "stage_id", "event_type", "title", "description", "start_at", "end_at",
                "location_id", "image_urls", "sort_order", "is_published"]


class EventIn(BaseModel):
    race_id: int
    stage_id: int | None = None
    event_type: ProgramEventType = Field(description="stage_start, stage_finish — гонка; festival — культурная "
                                                     "программа; master_class; meeting")
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_at: AwareDatetime
    end_at: AwareDatetime | None = None
    location_id: int | None = None
    image_urls: list[HttpUrl] = Field(default_factory=list, max_length=20)
    sort_order: int = Field(0, ge=0)
    is_published: bool = False


class EventPatch(BaseModel):
    stage_id: int | None = None
    event_type: ProgramEventType | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    start_at: AwareDatetime | None = None
    end_at: AwareDatetime | None = None
    location_id: int | None = None
    image_urls: list[HttpUrl] | None = Field(None, max_length=20)
    sort_order: int | None = Field(None, ge=0)
    is_published: bool | None = None


def check_event_times(start: datetime, end: datetime | None) -> None:
    if end is not None and end < start:
        raise HTTPException(status_code=422, detail="Окончание события раньше начала")


@router.get("/races/{race_id}/program", summary="Программа гонки, включая черновики")
async def list_events(race_id: int, session: SessionDep, admin: AdminDep):
    items = await session.scalars(select(ProgramEvent).where(ProgramEvent.race_id == race_id)
                                  .order_by(ProgramEvent.start_at, ProgramEvent.sort_order, ProgramEvent.id))
    return ok([plain(i, EVENT_FIELDS) for i in items])


@router.post("/program", status_code=201, summary="Новое событие программы")
async def create_event(body: EventIn, session: SessionDep, admin: AdminDep):
    await check_links(session, body.race_id, body.stage_id, body.location_id)
    check_event_times(body.start_at, body.end_at)
    item = ProgramEvent()
    apply(item, body.model_dump())
    session.add(item)
    await save(session, "Событие не сохранено: проверьте этап и время")
    return ok(plain(item, EVENT_FIELDS))


@router.patch("/program/{item_id}", summary="Изменить событие программы")
async def patch_event(item_id: int, body: EventPatch, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, ProgramEvent, item_id)
    data = body.model_dump(exclude_unset=True)
    await check_links(session, item.race_id, data.get("stage_id"), data.get("location_id"))
    apply(item, data)
    check_event_times(item.start_at, item.end_at)
    await save(session, "Событие не сохранено: проверьте этап и время")
    return ok(plain(item, EVENT_FIELDS))


@router.delete("/program/{item_id}", summary="Удалить событие")
async def delete_event(item_id: int, session: SessionDep, admin: AdminDep):
    item = await get_or_404(session, ProgramEvent, item_id)
    out = plain(item, EVENT_FIELDS)
    await session.delete(item)
    await session.commit()
    return ok(out)


# ── FAQ и контакты ─────────────────────────────────────────────────────

FAQ_FIELDS = ["id", "question", "answer", "sort_order", "is_published"]
CONTACT_FIELDS = ["id", "title", "name", "phone", "email", "url", "sort_order", "is_published"]


class FaqIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1)
    sort_order: int = Field(0, ge=0)
    is_published: bool = False


class FaqPatch(BaseModel):
    question: str | None = Field(None, min_length=1, max_length=500)
    answer: str | None = Field(None, min_length=1)
    sort_order: int | None = Field(None, ge=0)
    is_published: bool | None = None


class ContactIn(BaseModel):
    title: str = Field(min_length=1, max_length=200, examples=["Оргкомитет"])
    name: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=100)
    email: str | None = Field(None, max_length=320)
    url: str | None = Field(None, max_length=2000)
    sort_order: int = Field(0, ge=0)
    is_published: bool = False


class ContactPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    name: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=100)
    email: str | None = Field(None, max_length=320)
    url: str | None = Field(None, max_length=2000)
    sort_order: int | None = Field(None, ge=0)
    is_published: bool | None = None


def simple_crud(path: str, model, fields: list[str], create_schema, patch_schema, title: str) -> None:
    @router.get(f"/{path}", summary=f"{title}: все, включая черновики")
    async def list_items(session: SessionDep, admin: AdminDep):
        items = await session.scalars(select(model).order_by(model.sort_order, model.id))
        return ok([plain(i, fields) for i in items])

    @router.post(f"/{path}", status_code=201, summary=f"{title}: добавить")
    async def create_item(body: create_schema, session: SessionDep, admin: AdminDep):
        item = model(**body.model_dump())
        session.add(item)
        await save(session, "Запись не сохранена")
        return ok(plain(item, fields))

    @router.patch(f"/{path}/{{item_id}}", summary=f"{title}: изменить")
    async def patch_item(item_id: int, body: patch_schema, session: SessionDep, admin: AdminDep):
        item = await get_or_404(session, model, item_id)
        apply(item, body.model_dump(exclude_unset=True))
        await save(session, "Запись не сохранена")
        return ok(plain(item, fields))

    @router.delete(f"/{path}/{{item_id}}", summary=f"{title}: удалить")
    async def delete_item(item_id: int, session: SessionDep, admin: AdminDep):
        item = await get_or_404(session, model, item_id)
        out = plain(item, fields)
        await session.delete(item)
        await session.commit()
        return ok(out)


class GuestInfoIn(BaseModel):
    section: str = Field(pattern=r"^(how_to_get_there|what_to_bring|safety)$",
                         description="how_to_get_there — как добраться, what_to_bring — что взять, safety — безопасность")
    title: str | None = Field(None, max_length=200, examples=["Самолётом"])
    text: str = Field(min_length=1)
    sort_order: int = Field(0, ge=0)
    is_published: bool = False


class GuestInfoPatch(BaseModel):
    section: str | None = Field(None, pattern=r"^(how_to_get_there|what_to_bring|safety)$")
    title: str | None = Field(None, max_length=200)
    text: str | None = Field(None, min_length=1)
    sort_order: int | None = Field(None, ge=0)
    is_published: bool | None = None


GUEST_FIELDS = ["id", "section", "title", "text", "sort_order", "is_published"]

simple_crud("faq", FaqItem, FAQ_FIELDS, FaqIn, FaqPatch, "FAQ")
simple_crud("guest-info", GuestInfoItem, GUEST_FIELDS, GuestInfoIn, GuestInfoPatch, "Гостям")
simple_crud("contacts", OrganizerContact, CONTACT_FIELDS, ContactIn, ContactPatch, "Контакты")
