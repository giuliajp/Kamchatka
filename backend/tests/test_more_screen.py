"""Экран «Ещё»: раздел «Гостям», переключатели push, сохранённый протокол, PDF этапа."""

import httpx
import pytest

from app.config import get_settings
from app.models import (
    AdminUser, AppUser, Discipline, Equipment, Participant, Race, RaceParticipant, Stage, SupportSubscription,
)
from app.services import push, vk_api
from app.services.admin_auth import hash_password, issue_token
from app.services.vk_auth import sign_launch_params

SECRET = "vk-secret"


@pytest.fixture(autouse=True)
def vk(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "vk_app_secret", SECRET)
    monkeypatch.setattr(s, "vk_app_id", "")
    monkeypatch.setattr(s, "vk_dev_user_id", None)
    monkeypatch.setattr(s, "vk_service_token", "service")
    sent = []

    def handler(request: httpx.Request) -> httpx.Response:
        form = dict(httpx.QueryParams(request.content.decode()))
        sent.append(form)
        return httpx.Response(200, json={"response": [{"user_id": int(i), "status": True}
                                                      for i in form["user_ids"].split(",")]})

    monkeypatch.setattr(vk_api, "transport", httpx.MockTransport(handler))
    return sent


def user(user_id: int) -> dict:
    return {"X-VK-Launch-Params": sign_launch_params({"vk_user_id": str(user_id), "vk_app_id": "1"}, SECRET)}


@pytest.fixture
async def auth(session):
    admin = AdminUser(login="org", full_name="Контент", password_hash=hash_password("пароль-123456"))
    session.add(admin)
    await session.commit()
    return {"Authorization": f"Bearer {issue_token(admin.id)[0]}"}


async def test_guest_info(client, auth):
    for body in ({"section": "how_to_get_there", "title": "Самолётом", "text": "Аэропорт Елизово (PKC).",
                  "is_published": True},
                 {"section": "what_to_bring", "text": "Термос с горячим питьём", "is_published": True},
                 {"section": "safety", "text": "Не выходите на трассу", "sort_order": 1, "is_published": True},
                 {"section": "safety", "text": "Черновик правила"}):
        assert (await client.post("/api/admin/guest-info", headers=auth, json=body)).status_code == 201
    assert (await client.post("/api/admin/guest-info", headers=auth,
                              json={"section": "weather", "text": "x"})).status_code == 422
    data = (await client.get("/api/guest-info")).json()["data"]
    assert data["how_to_get_there"][0]["title"] == "Самолётом"
    assert [i["text"] for i in data["safety"]] == ["Не выходите на трассу"]
    assert len((await client.get("/api/admin/guest-info", headers=auth)).json()["data"]) == 4


async def test_notification_settings(client):
    assert (await client.get("/api/me/notification-settings", headers=user(1))).json()["data"] == {
        "notifications_allowed": False, "checkpoints": True, "results": True, "news": True}
    changed = (await client.put("/api/me/notification-settings", headers=user(1),
                                json={"news": False})).json()["data"]
    assert (changed["checkpoints"], changed["news"]) == (True, False)
    again = (await client.put("/api/me/notification-settings", headers=user(1),
                              json={"checkpoints": False})).json()["data"]
    assert (again["checkpoints"], again["news"]) == (False, False)
    assert (await client.put("/api/me/notification-settings", json={})).status_code == 401


async def test_switches_filter_push(session, vk):
    race = Race(name="А", year=2027)
    sled = Discipline(code="d", name="Д", equipment=Equipment.SLED, dogs_min=8)
    entry = RaceParticipant(race=race, discipline=sled, start_number=14,
                            participant=Participant(last_name="Попов", first_name="Алексей"))
    session.add_all([race, sled, entry,
                     AppUser(vk_user_id=1, notifications_allowed=True),                         # всё включено
                     AppUser(vk_user_id=2, notifications_allowed=True, notify_checkpoints=False),
                     AppUser(vk_user_id=3, notifications_allowed=True, notify_news=False, notify_results=False)])
    await session.flush()
    session.add_all([SupportSubscription(vk_user_id=u, race_participant_id=entry.id) for u in (1, 2, 3, 9)])
    await session.commit()

    def ids(segment, trigger):
        return push.recipients(session, segment, trigger)

    assert sorted(await ids(f"supporters:{entry.id}", "checkpoint")) == [1, 3, 9]
    assert sorted(await ids(f"supporters:{entry.id}", "protocol")) == [1, 2, 9]
    assert sorted(await ids("all", "leader")) == [1, 2]
    assert sorted(await ids("all", "manual")) == [1, 2]
    assert sorted(await ids("all", "stage_start")) == [1, 2]


async def test_protocol_bookmark_and_stage_pdf(client, session, auth):
    race = Race(name="А", year=2027)
    stage = Stage(race=race, number=3)
    session.add_all([race, stage])
    await session.commit()
    patched = await client.patch(f"/api/admin/stages/{stage.id}", headers=auth,
                                 json={"protocol_pdf_url": "https://example.ru/etap3.pdf"})
    assert patched.json()["data"]["protocol_pdf_url"].endswith("etap3.pdf")
    assert (await client.get(f"/api/stages/{stage.id}")).json()["data"]["protocol_pdf_url"].endswith("etap3.pdf")

    body = {"kind": "protocol", "item_id": f"stage:{stage.id}", "title": "Протокол этапа 3",
            "url": "https://example.ru/etap3.pdf"}
    assert (await client.put("/api/me/bookmarks", headers=user(5), json=body)).status_code == 200
    assert (await client.put("/api/me/bookmarks", headers=user(5),
                             json={**body, "url": None})).status_code == 422
    assert (await client.put("/api/me/bookmarks", headers=user(5),
                             json={**body, "item_id": "-1_1"})).status_code == 422
    saved = (await client.get("/api/me/bookmarks", headers=user(5))).json()["data"]
    assert saved[0]["kind"] == "protocol" and saved[0]["title"] == "Протокол этапа 3"
    gone = await client.delete(f"/api/me/bookmarks/protocol/stage:{stage.id}", headers=user(5))
    assert gone.json()["data"]["deleted"] == 1


async def test_segment_description_in_admin(client, session, auth):
    race = Race(name="А", year=2027)
    stage = Stage(race=race, number=1)
    session.add_all([race, stage])
    await session.commit()
    place = (await client.post("/api/admin/checkpoints", headers=auth,
                               json={"name": "Пиначево", "latitude": 53.1, "longitude": 158.6})).json()["data"]
    kp = (await client.post(f"/api/admin/stages/{stage.id}/checkpoints", headers=auth, json={
        "checkpoint_id": place["id"], "order_index": 1, "segment_description": "Подъём на перевал"})).json()["data"]
    assert kp["segment_description"] == "Подъём на перевал"
    public = (await client.get(f"/api/stages/{stage.id}")).json()["data"]["checkpoints"][0]
    assert public["segment_description"] == "Подъём на перевал"
