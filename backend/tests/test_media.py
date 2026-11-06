"""Новости и фото из VK, закладки, согласие на push, ручная рассылка (3.7)."""

import httpx
import pytest

from app.api.routes import media
from app.config import get_settings
from app.models import AdminUser, Discipline, Equipment, Participant, Race, RaceParticipant, SupportSubscription
from app.services import vk_api
from app.services.admin_auth import hash_password, issue_token
from app.services.vk_auth import sign_launch_params

SECRET = "vk-secret"
POST = {"id": 77, "owner_id": -123, "date": 1770000000, "text": "Этап 2 завершён\nПервым финишировал №18.\nПодробности…",
        "attachments": [{"type": "photo", "photo": {"sizes": [
            {"url": "https://vk/s.jpg", "width": 100, "height": 50},
            {"url": "https://vk/x.jpg", "width": 1200, "height": 800}]}}],
        "likes": {"count": 5}, "reposts": {"count": 2}}
REPOST = {"id": 78, "owner_id": -123, "date": 1770000100, "text": "", "post_type": "post",
          "copy_history": [{"text": "Репост: новости федерации"}]}
PHOTOS = [{"id": 1, "owner_id": -123, "date": 1770000000, "sizes": [{"url": "https://vk/1.jpg", "width": 10, "height": 10}]},
          {"id": 2, "owner_id": -123, "date": 1770100000, "sizes": [{"url": "https://vk/2.jpg", "width": 10, "height": 10}]}]


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "vk_app_secret", SECRET)
    monkeypatch.setattr(s, "vk_app_id", "")
    monkeypatch.setattr(s, "vk_dev_user_id", None)
    monkeypatch.setattr(s, "vk_service_token", "service")
    monkeypatch.setattr(s, "vk_group_id", 123)
    media._cache.clear()
    yield s
    media._cache.clear()


@pytest.fixture
def vk(monkeypatch):
    state = {"calls": [], "fail": False}

    def handler(request: httpx.Request) -> httpx.Response:
        method = request.url.path.rsplit("/", 1)[-1]
        form = dict(httpx.QueryParams(request.content.decode()))
        state["calls"].append((method, form))
        if state["fail"]:
            return httpx.Response(200, json={"error": {"error_code": 6, "error_msg": "Too many requests"}})
        if method == "wall.get":
            return httpx.Response(200, json={"response": {"count": 2, "items": [POST, REPOST]}})
        if method == "photos.get":
            return httpx.Response(200, json={"response": {"count": 2, "items": PHOTOS}})
        ids = form["user_ids"].split(",")
        return httpx.Response(200, json={"response": [{"user_id": int(i), "status": i != "3"} for i in ids]})

    monkeypatch.setattr(vk_api, "transport", httpx.MockTransport(handler))
    return state


def user(user_id: int, notifications: str = "1") -> dict:
    params = {"vk_user_id": str(user_id), "vk_app_id": "1", "vk_are_notifications_enabled": notifications}
    return {"X-VK-Launch-Params": sign_launch_params(params, SECRET)}


async def test_news_cards_and_cache(client, vk):
    data = (await client.get("/api/news")).json()["data"]
    first = data["items"][0]
    assert (first["id"], first["title"], first["cover_url"]) == ("-123_77", "Этап 2 завершён", "https://vk/x.jpg")
    assert first["preview"].startswith("Первым финишировал") and first["url"] == "https://vk.com/wall-123_77"
    assert data["items"][1]["title"] == "Репост: новости федерации"
    assert vk["calls"][0][1]["owner_id"] == "-123"

    vk["fail"] = True
    again = (await client.get("/api/news")).json()["data"]           # из памяти, VK не трогаем
    assert again["stale"] is False and len(vk["calls"]) == 1
    media._cache["news:0:20"] = (-1e9, media._cache["news:0:20"][1])   # «протухло»
    stale = (await client.get("/api/news")).json()["data"]
    assert stale["stale"] is True and stale["items"]
    assert (await client.get("/api/news?offset=20")).status_code == 503


async def test_photos_grouped_by_kamchatka_day(client, vk):
    days = (await client.get("/api/photos")).json()["data"]["days"]
    assert [d["date"] for d in days] == ["2026-02-03", "2026-02-02"]


@pytest.mark.parametrize("path", ["/news", "/photos", "/photos/albums"])
async def test_news_without_group_id(client, settings, monkeypatch, caplog, path):
    monkeypatch.setattr(settings, "vk_group_id", None)
    response = await client.get("/api" + path)
    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Материалы VK временно недоступны. Попробуйте позже"
    assert "VK_GROUP_ID" in caplog.text


async def test_bookmarks(client):
    body = {"kind": "news", "item_id": "-123_77", "title": "Этап 2 завершён", "url": "https://vk.com/wall-123_77"}
    assert (await client.put("/api/me/bookmarks", json=body)).status_code == 401
    await client.put("/api/me/bookmarks", headers=user(5), json=body)
    await client.put("/api/me/bookmarks", headers=user(5), json=body)
    items = (await client.get("/api/me/bookmarks", headers=user(5))).json()["data"]
    assert len(items) == 1 and items[0]["title"] == "Этап 2 завершён"
    assert (await client.get("/api/me/bookmarks", headers=user(6))).json()["data"] == []
    assert (await client.put("/api/me/bookmarks", headers=user(5),
                             json={**body, "kind": "video"})).status_code == 422
    gone = await client.delete("/api/me/bookmarks/news/-123_77", headers=user(5))
    assert gone.json()["data"]["deleted"] == 1


async def test_visit_and_manual_push(client, session, vk):
    await client.post("/api/me/visit", headers=user(1, "1"))
    await client.post("/api/me/visit", headers=user(2, "0"))
    await client.post("/api/me/visit", headers=user(3, "1"))
    await client.put("/api/me/notifications", headers=user(2), json={"allowed": True})
    await client.put("/api/me/notifications", headers=user(1), json={"allowed": False})

    race = Race(name="А", year=2027)
    sled = Discipline(code="d", name="Д", equipment=Equipment.SLED, dogs_min=8)
    entry = RaceParticipant(race=race, discipline=sled, start_number=14,
                            participant=Participant(last_name="Попов", first_name="Алексей"))
    admin = AdminUser(login="pr", full_name="Пресс-служба", password_hash=hash_password("пароль-123456"))
    session.add_all([race, sled, entry, admin])
    await session.flush()
    # 1 — запретил в приложении, 9 — приложение не открывал (пробуем), 2 — выключил уведомления по участнику
    session.add_all([SupportSubscription(vk_user_id=1, race_participant_id=entry.id),
                     SupportSubscription(vk_user_id=9, race_participant_id=entry.id),
                     SupportSubscription(vk_user_id=2, race_participant_id=entry.id, notifications_enabled=False)])
    await session.commit()
    token, _ = issue_token(admin.id)
    auth = {"Authorization": f"Bearer {token}"}

    everyone = (await client.post("/api/admin/push", headers=auth,
                                  json={"message": "Завтра старт этапа 3 в 10:00 по Камчатке"})).json()["data"]
    assert (everyone["segment"], everyone["recipients"], everyone["delivered"]) == ("all", 2, 1)  # 3 — VK отказал
    assert set(vk["calls"][-1][1]["user_ids"].split(",")) == {"2", "3"}

    fans = (await client.post("/api/admin/push", headers=auth, json={
        "message": "Каюр №14 благодарит болельщиков", "race_participant_id": entry.id})).json()["data"]
    assert fans["recipients"] == 1 and vk["calls"][-1][1]["user_ids"] == "9"

    vk["fail"] = True
    failed = (await client.post("/api/admin/push", headers=auth, json={"message": "Проверка"})).json()["data"]
    assert failed["delivered"] == 0 and "Too many requests" in failed["error"]
    assert len((await client.get("/api/admin/push", headers=auth)).json()["data"]) == 3
    too_long = await client.post("/api/admin/push", headers=auth, json={"message": "x" * 300})
    assert too_long.status_code == 422
