"""Доработки под макеты: контент в админке, напоминания, «Мой результат», ETA лидеров, альбомы."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.api.routes import media
from app.config import get_settings
from app.models import (
    AdminUser, Discipline, Equipment, Participant, Penalty, Race, RaceParticipant, Stage, StageStatus,
    TrackerDevice, TrackerPosition,
)
from app.services import vk_api
from app.services.admin_auth import hash_password, issue_token
from app.services.reminders import send_due_reminders
from app.services.vk_auth import sign_launch_params

SECRET = "vk-secret"
NOW = datetime.now(UTC).replace(microsecond=0)


@pytest.fixture(autouse=True)
def vk(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "vk_app_secret", SECRET)
    monkeypatch.setattr(s, "vk_app_id", "")
    monkeypatch.setattr(s, "vk_dev_user_id", None)
    monkeypatch.setattr(s, "vk_service_token", "service")
    monkeypatch.setattr(s, "vk_group_id", 123)
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        method = request.url.path.rsplit("/", 1)[-1]
        form = dict(httpx.QueryParams(request.content.decode()))
        calls.append((method, form))
        if method == "photos.getAlbums":
            return httpx.Response(200, json={"response": {"count": 1, "items": [
                {"id": 55, "title": "Берингия. Авача-2026. Шестой этап", "size": 40, "thumb_src": "https://vk/t.jpg"}]}})
        ids = form.get("user_ids", "").split(",")
        return httpx.Response(200, json={"response": [{"user_id": int(i), "status": True} for i in ids if i]})

    monkeypatch.setattr(vk_api, "transport", httpx.MockTransport(handler))
    media._cache.clear()
    return calls


def user(user_id: int) -> dict:
    return {"X-VK-Launch-Params": sign_launch_params({"vk_user_id": str(user_id), "vk_app_id": "1"}, SECRET)}


@pytest.fixture
async def base(session):
    race = Race(name="Авача 2027", year=2027, is_current=True, protocol_pdf_url="https://sleddog-russia.ru/p.pdf")
    other = Race(name="Авача 2026", year=2026)
    sled = Discipline(code="sled_8", name="Нарта 8", equipment=Equipment.SLED, dogs_min=8, dogs_max=8)
    stage = Stage(race=race, number=1, status=StageStatus.LIVE, start_at=NOW - timedelta(hours=2),
                  route_geojson={"type": "LineString", "coordinates": [[158.0, 53.0], [158.0, 53.5]]},
                  route_updated_at=NOW)
    foreign_stage = Stage(race=other, number=1)
    person = Participant(last_name="Попов", first_name="Алексей", birth_year=1972)
    entry = RaceParticipant(race=race, discipline=sled, start_number=14, participant=person, dog_breed="Ездовые лайки")
    admin = AdminUser(login="org", full_name="Контент-менеджер", password_hash=hash_password("пароль-123456"))
    session.add_all([race, other, sled, stage, foreign_stage, entry, admin,
                     Penalty(race_participant=entry, seconds=300, reason="Нарушение правил старта")])
    await session.commit()
    token, _ = issue_token(admin.id)
    return {"race": race, "stage": stage, "foreign_stage": foreign_stage, "entry": entry, "person": person,
            "auth": {"Authorization": f"Bearer {token}"}}


async def test_content_admin_and_public_fields(client, base):
    auth, race_id = base["auth"], base["race"].id
    location = await client.post("/api/admin/locations", headers=auth, json={
        "race_id": race_id, "location_type": "checkpoint", "name": "КВТЦ", "latitude": 53.05, "longitude": 158.65,
        "image_urls": ["https://example.ru/kvtc.jpg"], "is_published": True})
    assert location.status_code == 201
    loc_id = location.json()["data"]["id"]
    event = await client.post("/api/admin/program", headers=auth, json={
        "race_id": race_id, "event_type": "master_class", "title": "Мастер-классы для детей",
        "start_at": "2027-02-05T13:00:00+12:00", "end_at": "2027-02-05T15:00:00+12:00", "location_id": loc_id,
        "image_urls": ["https://example.ru/mk.jpg"]})
    assert event.status_code == 201 and event.json()["data"]["start_at"].startswith("2027-02-05T01:00:00")
    event_id = event.json()["data"]["id"]
    assert (await client.get("/api/program")).json()["data"] == []           # черновик не виден
    await client.patch(f"/api/admin/program/{event_id}", headers=auth, json={"is_published": True})
    public = (await client.get("/api/program?type=master_class")).json()["data"][0]
    assert public["image_urls"] == ["https://example.ru/mk.jpg"]
    assert public["location"]["location_type"] == "checkpoint"

    bad = await client.post("/api/admin/program", headers=auth, json={
        "race_id": race_id, "stage_id": base["foreign_stage"].id, "event_type": "stage_start", "title": "Старт",
        "start_at": "2027-02-05T10:00:00+12:00"})
    assert bad.status_code == 422
    backwards = await client.patch(f"/api/admin/program/{event_id}", headers=auth,
                                   json={"end_at": "2027-02-05T12:00:00+12:00"})
    assert backwards.status_code == 422

    faq = await client.post("/api/admin/faq", headers=auth, json={
        "question": "Что взять с собой?", "answer": "Тёплую одежду", "is_published": True})
    assert faq.status_code == 201
    contact = await client.post("/api/admin/contacts", headers=auth, json={"title": "Оргкомитет", "is_published": True})
    await client.patch(f"/api/admin/contacts/{contact.json()['data']['id']}", headers=auth, json={"phone": "+7 900"})
    assert (await client.get("/api/contacts")).json()["data"][0]["phone"] == "+7 900"
    assert (await client.delete(f"/api/admin/faq/{faq.json()['data']['id']}", headers=auth)).status_code == 200
    assert (await client.get("/api/faq")).json()["data"] == []


async def test_event_reminders(client, session, base, vk):
    auth = base["auth"]
    soon = (NOW + timedelta(minutes=20)).isoformat()
    event = (await client.post("/api/admin/program", headers=auth, json={
        "race_id": base["race"].id, "event_type": "festival", "title": "Обряд встречи гостей",
        "start_at": soon, "is_published": True})).json()["data"]
    draft = (await client.post("/api/admin/program", headers=auth, json={
        "race_id": base["race"].id, "event_type": "festival", "title": "Черновик", "start_at": soon})).json()["data"]
    assert (await client.put(f"/api/program/{draft['id']}/reminder", headers=user(5))).status_code == 404
    assert (await client.put(f"/api/program/{event['id']}/reminder")).status_code == 401
    await client.put(f"/api/program/{event['id']}/reminder", headers=user(5))
    await client.put(f"/api/program/{event['id']}/reminder", headers=user(5))
    assert (await client.get("/api/me/reminders", headers=user(5))).json()["data"]["program_event_ids"] == [event["id"]]

    assert await send_due_reminders(session, NOW - timedelta(hours=1)) == 0         # рано
    assert await send_due_reminders(session, NOW) == 1
    sent = [form for method, form in vk if method == "notifications.sendMessage"]
    assert sent[0]["user_ids"] == "5" and "Обряд встречи гостей" in sent[0]["message"]
    assert await send_due_reminders(session, NOW) == 0                               # второй раз не шлём
    await client.delete(f"/api/program/{event['id']}/reminder", headers=user(5))
    assert (await client.get("/api/me/reminders", headers=user(5))).json()["data"]["program_event_ids"] == []


async def test_my_result_link_and_card_fields(client, session, base):
    auth = base["auth"]
    assert (await client.get("/api/me", headers=user(42))).json()["data"]["participant_id"] is None
    linked = await client.patch(f"/api/admin/participants/{base['person'].id}", headers=auth, json={"vk_user_id": 42})
    assert linked.json()["data"]["vk_user_id"] == 42
    me = (await client.get("/api/me", headers=user(42))).json()["data"]
    assert me["participant_id"] == base["person"].id and me["race_entries"][0]["start_number"] == 14

    other = (await client.post(f"/api/admin/races/{base['race'].id}/participants", headers=auth, json={
        "last_name": "Шевчук", "first_name": "Георгий", "discipline_id": base["entry"].discipline_id,
        "start_number": 18})).json()["data"]
    taken = await client.patch(f"/api/admin/participants/{other['participant']['id']}", headers=auth,
                               json={"vk_user_id": 42})
    assert taken.status_code == 409

    card = (await client.get(f"/api/participants/{base['person'].id}")).json()["data"]
    entry = card["races"][0]
    assert entry["dog_breed"] == "Ездовые лайки"
    assert entry["penalties"] == [{"seconds": 300, "time": "00:05:00", "reason": "Нарушение правил старта",
                                   "rule_reference": None}]
    listing = (await client.get(f"/api/races/{base['race'].id}/participants")).json()["data"]
    assert listing[0]["dog_breed"] == "Ездовые лайки"
    race = (await client.get("/api/races/current")).json()["data"]
    assert race["protocol_pdf_url"].endswith("p.pdf")


async def test_arrival_estimate(client, session, base):
    stage, entry = base["stage"], base["entry"]
    device = TrackerDevice(imei="300234063471014")
    session.add(device)
    await session.flush()
    # Трек ~55,6 км на север. Две точки: 11,1 км за 1 час → 11,1 км/ч; осталось ~33 км → ~3 ч.
    for minutes_ago, lat in ((70, 53.1), (10, 53.2)):
        session.add(TrackerPosition(tracker_device_id=device.id, race_participant_id=entry.id, stage_id=stage.id,
                                    position_at=NOW - timedelta(minutes=minutes_ago), latitude=lat, longitude=158.0))
    await session.commit()
    data = (await client.get(f"/api/stages/{stage.id}/arrival-estimate")).json()["data"]
    leader = data["leaders"][0]
    assert leader["start_number"] == 14 and 33 < leader["remaining_km"] < 34
    start, end = (datetime.fromisoformat(data["first"][k]) for k in ("from", "to"))
    assert start < datetime.fromisoformat(leader["expected_at"]) < end
    assert start.minute % 10 == 0 and end.minute % 10 == 0
    assert timedelta(hours=2) < start - NOW < timedelta(hours=3) < end - NOW

    stage.status = StageStatus.FINISHED
    await session.commit()
    assert (await client.get(f"/api/stages/{stage.id}/arrival-estimate")).json()["data"]["first"] is None


async def test_albums(client, vk):
    items = (await client.get("/api/photos/albums")).json()["data"]["items"]
    assert items[0]["title"].endswith("Шестой этап") and items[0]["url"] == "https://vk.com/album-123_55"
    assert (await client.get("/api/photos?album_id=../x")).status_code == 422
