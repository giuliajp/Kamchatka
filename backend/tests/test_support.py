"""«Болею за»: подпись VK, подписка, счётчик за сутки, рейтинг, профиль, CSV для админки."""

from datetime import UTC, datetime, timedelta

import pytest

from app.config import get_settings
from app.models import (
    AdminUser, Discipline, Equipment, Participant, Race, RaceParticipant, SupportSubscription,
)
from app.services.admin_auth import hash_password, issue_token
from app.services.vk_auth import launch_params_user, sign_launch_params

SECRET = "test-vk-secret"
NOW = datetime.now(UTC).replace(microsecond=0)


@pytest.fixture(autouse=True)
def vk_secret(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "vk_app_secret", SECRET)
    monkeypatch.setattr(settings, "vk_app_id", "51234567")
    monkeypatch.setattr(settings, "vk_dev_user_id", None)


def vk(user_id: int, secret: str = SECRET) -> dict:
    params = {"vk_user_id": str(user_id), "vk_app_id": "51234567", "vk_ts": "1700000000",
              "vk_platform": "mobile_android", "vk_language": "ru"}
    return {"X-VK-Launch-Params": "?" + sign_launch_params(params, secret)}


@pytest.fixture
async def race(session):
    race = Race(name="Авача 2027", year=2027)
    sled = Discipline(code="sled_8", name="Нарта 8", equipment=Equipment.SLED, dogs_min=8, dogs_max=8)
    ski = Discipline(code="ski_2", name="Лыжи", equipment=Equipment.SKI, dogs_min=1, dogs_max=2)

    def entry(number, name, discipline):
        return RaceParticipant(race=race, discipline=discipline, start_number=number,
                               participant=Participant(last_name=name, first_name="Тест"))

    a, b, c = entry(14, "Попов", sled), entry(18, "Шевчук", sled), entry(4, "Филимонова", ski)
    session.add_all([race, sled, ski, a, b, c])
    await session.flush()
    # История: двое болели со вчера, один отписался час назад, один подписался сегодня.
    session.add_all([
        SupportSubscription(vk_user_id=1, race_participant_id=b.id, created_at=NOW - timedelta(days=2)),
        SupportSubscription(vk_user_id=2, race_participant_id=b.id, created_at=NOW - timedelta(days=2),
                            cancelled_at=NOW - timedelta(hours=1)),
        SupportSubscription(vk_user_id=3, race_participant_id=b.id, created_at=NOW - timedelta(hours=2)),
        SupportSubscription(vk_user_id=4, race_participant_id=c.id, created_at=NOW - timedelta(hours=3)),
    ])
    await session.commit()
    return {"race": race, "a": a, "b": b, "c": c}


def test_vk_signature():
    raw = vk(77)["X-VK-Launch-Params"]
    assert launch_params_user(raw, SECRET) == 77
    assert launch_params_user(raw, SECRET, app_id="51234567") == 77
    assert launch_params_user(raw, SECRET, app_id="999") is None          # чужое приложение
    assert launch_params_user(raw, "другой ключ") is None
    assert launch_params_user(raw.replace("vk_user_id=77", "vk_user_id=78"), SECRET) is None
    assert launch_params_user("vk_user_id=77", SECRET) is None            # без подписи
    assert launch_params_user(raw, "") is None


def test_vk_signature_matches_vk_docs_example():
    # Пример из документации VK (github.com/VKCOM/vk-apps-launch-params).
    query = ("vk_user_id=494075&vk_app_id=6736218&vk_is_app_user=1&vk_are_notifications_enabled=1"
             "&vk_language=ru&vk_access_token_settings=&vk_platform=android"
             "&sign=htQFduJpLxz7ribXRZpDFUH-XEUhC9rBPTJkjUFEkRA")
    assert launch_params_user(query, "wvl68m4dR1UpLrVRli") == 494075


async def test_support_flow(client, race):
    entry = race["a"].id
    anonymous = (await client.get(f"/api/race-participants/{entry}/support")).json()["data"]
    assert anonymous["supporters_count"] == 0 and anonymous["is_supported"] is None

    assert (await client.put(f"/api/race-participants/{entry}/support")).status_code == 401
    first = (await client.put(f"/api/race-participants/{entry}/support", headers=vk(100))).json()["data"]
    again = (await client.put(f"/api/race-participants/{entry}/support", headers=vk(100))).json()["data"]
    assert first["supporters_count"] == again["supporters_count"] == 1      # повторное нажатие
    assert again["is_supported"] is True and again["change_24h"] == 1

    off = await client.patch(f"/api/me/supports/{entry}", headers=vk(100), json={"notifications_enabled": False})
    assert off.json()["data"]["notifications_enabled"] is False

    removed = (await client.delete(f"/api/race-participants/{entry}/support", headers=vk(100))).json()["data"]
    assert removed["supporters_count"] == 0 and removed["is_supported"] is False
    # подписаться снова можно
    back = (await client.put(f"/api/race-participants/{entry}/support", headers=vk(100))).json()["data"]
    assert back["supporters_count"] == 1


async def test_counts_and_change_24h(client, race):
    b = (await client.get(f"/api/race-participants/{race['b'].id}/support", headers=vk(1))).json()["data"]
    # сейчас: 1 и 3 → 2; сутки назад: 1 и 2 → 2; изменение 0
    assert (b["supporters_count"], b["change_24h"], b["is_supported"]) == (2, 0, True)


async def test_rating_and_participants_sort(client, race):
    rating = (await client.get(f"/api/races/{race['race'].id}/support-rating")).json()["data"]
    assert [(i["start_number"], i["supporters_count"], i["rank"]) for i in rating] == [
        (18, 2, 1), (4, 1, 2), (14, 0, 3)]
    assert rating[1]["change_24h"] == 1
    sled = (await client.get(f"/api/races/{race['race'].id}/support-rating?discipline=sled_8")).json()["data"]
    assert [i["start_number"] for i in sled] == [18, 14]

    items = (await client.get(f"/api/races/{race['race'].id}/participants?sort=supporters")).json()["data"]
    assert [(i["start_number"], i["supporters_count"]) for i in items] == [(18, 2), (4, 1), (14, 0)]


async def test_my_supports_and_cancel_all(client, race):
    await client.put(f"/api/race-participants/{race['a'].id}/support", headers=vk(1))
    mine = (await client.get("/api/me/supports", headers=vk(1))).json()["data"]
    assert sorted(i["start_number"] for i in mine) == [14, 18]
    cancelled = (await client.delete("/api/me/supports", headers=vk(1))).json()["data"]
    assert cancelled == {"cancelled": 2}
    assert (await client.get("/api/me/supports", headers=vk(1))).json()["data"] == []
    assert (await client.get("/api/me/supports")).status_code == 401


async def test_dev_user_only_outside_production(client, race, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "vk_dev_user_id", 555)
    ok = await client.put(f"/api/race-participants/{race['a'].id}/support")
    assert ok.status_code == 200
    monkeypatch.setattr(settings, "environment", "production")
    assert (await client.put(f"/api/race-participants/{race['a'].id}/support")).status_code == 401


async def test_support_stats_csv(client, session, race):
    admin = AdminUser(login="a", full_name="А", password_hash=hash_password("пароль-123456"))
    session.add(admin)
    await session.commit()
    token, _ = issue_token(admin.id)
    response = await client.get(f"/api/admin/races/{race['race'].id}/support-stats.csv?days=3",
                                headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    lines = response.text.lstrip("\ufeff").strip().splitlines()
    assert lines[0].startswith("Номер;Участник;Дисциплина;")
    assert len(lines[0].split(";")) == 6
    row18 = next(line for line in lines if line.startswith("18;"))
    assert row18.split(";")[-1] == "2"
