"""Админка: вход (3.2), мониторинг трекеров, отметки КП с журналом, SOS (3.6)."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete

from app.models import (
    AdminUser, AlertType, Checkpoint, CheckpointRole, Discipline, Equipment, Participant, Race,
    RaceParticipant, Stage, StageCheckpoint, StageStatus, TrackerAlert, TrackerAssignment,
    TrackerDevice, TrackerPosition,
)
from app.services.admin_auth import hash_password, issue_token, read_token, verify_password

NOW = datetime.now(UTC).replace(microsecond=0)
PASSWORD = "очень-секретно-1"


@pytest.fixture
async def admin(session):
    user = AdminUser(login="ivanov", full_name="Иван Иванов", password_hash=hash_password(PASSWORD))
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def auth(client, admin):
    response = await client.post("/api/admin/login", json={"login": "IVANOV", "password": PASSWORD})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['data']['token']}"}


@pytest.fixture
async def race(session):
    race = Race(name="Авача 2027", year=2027)
    sled = Discipline(code="sled_8", name="Нарта 8", equipment=Equipment.SLED, dogs_min=8, dogs_max=8)
    stage = Stage(race=race, number=2, status=StageStatus.LIVE, start_at=NOW - timedelta(hours=3))
    other = Race(name="Авача 2026", year=2026)
    other_stage = Stage(race=other, number=1)
    session.add_all([race, sled, stage, other, other_stage])

    def entry(number, name):
        return RaceParticipant(race=race, discipline=sled, start_number=number,
                               participant=Participant(last_name=name, first_name="Тест"))

    e15, e14, e7, e3 = entry(15, "Филимонова"), entry(14, "Филимонов"), entry(7, "Смирнов"), entry(3, "Петрова")
    place_a, place_b = (Checkpoint(name=n, latitude=53.0, longitude=158.0) for n in ("Елизово", "КП Авача"))
    start = StageCheckpoint(stage=stage, checkpoint=place_a, order_index=0, role=CheckpointRole.START, label="Старт")
    kp2 = StageCheckpoint(stage=stage, checkpoint=place_b, order_index=1, label="КП-2", required_rest_minutes=60)
    foreign_kp = StageCheckpoint(stage=other_stage, checkpoint=place_a, order_index=0, role=CheckpointRole.START)
    session.add_all([e15, e14, e7, e3, start, kp2, foreign_kp])
    await session.flush()

    devices = {}
    for e in (e15, e14, e7):   # у №3 трекера нет
        device = TrackerDevice(imei=f"3002340634710{e.start_number:02d}", name=f"Трекер {e.start_number}")
        devices[e.start_number] = device
        session.add_all([device, TrackerAssignment(tracker_device=device, race_participant_id=e.id,
                                                   valid_from=NOW - timedelta(days=1))])
    await session.flush()
    for number, minutes_ago in ((15, 47), (14, 47), (7, 10)):
        e = {15: e15, 14: e14, 7: e7}[number]
        session.add(TrackerPosition(tracker_device=devices[number], race_participant_id=e.id, stage_id=stage.id,
                                    position_at=NOW - timedelta(minutes=minutes_ago),
                                    latitude=52.978, longitude=158.672, battery_percent=41))
    session.add(TrackerAlert(tracker_device=devices[15], race_participant_id=e15.id, type=AlertType.SOS,
                             occurred_at=NOW - timedelta(minutes=47), latitude=52.978, longitude=158.672))
    await session.commit()
    return {"race": race, "stage": stage, "kp2": kp2, "start": start, "foreign_kp": foreign_kp,
            "e15": e15, "e14": e14, "e7": e7, "e3": e3}


# ── Вход ───────────────────────────────────────────────────────────────

def test_password_and_token_helpers():
    stored = hash_password("пароль-123456")
    assert verify_password("пароль-123456", stored) and not verify_password("другой", stored)
    assert not verify_password("x", "испорчено")
    token, expires = issue_token(5, now=NOW)
    assert read_token(token, now=NOW) == 5
    assert read_token(token, now=expires + timedelta(seconds=1)) is None
    payload, signature = token.split(".")
    assert read_token(f"{payload}.{signature[:-2]}xx", now=NOW) is None
    assert read_token("мусор", now=NOW) is None


async def test_login_and_me(client, auth):
    me = await client.get("/api/admin/me", headers=auth)
    assert me.json()["data"]["full_name"] == "Иван Иванов"


async def test_login_wrong_password(client, admin):
    response = await client.post("/api/admin/login", json={"login": "ivanov", "password": "не тот"})
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Неверный логин или пароль"


async def test_admin_endpoints_need_token(client, race):
    for headers in ({}, {"Authorization": "Bearer fake.token"}):
        response = await client.get(f"/api/admin/stages/{race['stage'].id}/monitoring", headers=headers)
        assert response.status_code == 401


async def test_disabled_admin_loses_access(client, session, admin, auth):
    admin.is_active = False
    await session.commit()
    assert (await client.get("/api/admin/me", headers=auth)).status_code == 401


# ── Мониторинг ─────────────────────────────────────────────────────────

async def test_monitoring(client, auth, race):
    response = await client.get(f"/api/admin/stages/{race['stage'].id}/monitoring", headers=auth)
    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["tracking_interval_minutes"], data["stale_after_minutes"]) == (20, 45)
    assert data["summary"] == {"total": 4, "sos": 1, "overdue": 2, "no_tracker": 1, "ok": 1}
    assert [r["start_number"] for r in data["rows"]] == [15, 14, 3, 7]   # SOS, просрочка, номер
    row15 = data["rows"][0]
    assert row15["active_alerts"][0]["imei"] == "300234063471015"
    assert row15["is_overdue"] is True and row15["minutes_since_last"] == 47
    assert row15["last_position"]["battery_percent"] == 41
    assert data["rows"][2]["tracker"] is None and data["rows"][2]["is_overdue"] is False
    assert [c["label"] for c in data["checkpoints"]] == ["Старт", "КП-2"]


async def test_monitoring_not_overdue_when_stage_not_live(client, session, auth, race):
    race["stage"].status = StageStatus.FINISHED
    await session.commit()
    data = (await client.get(f"/api/admin/stages/{race['stage'].id}/monitoring", headers=auth)).json()["data"]
    assert data["summary"]["overdue"] == 0


async def test_sos_not_in_public_api(client, race):
    body = (await client.get(f"/api/races/{race['race'].id}/positions")).text
    assert "alert" not in body and "sos" not in body.lower()


# ── Отметки КП ─────────────────────────────────────────────────────────

def pass_body(race, **extra):
    return {"race_participant_id": race["e14"].id, "stage_checkpoint_id": race["kp2"].id,
            "arrived_at": (NOW - timedelta(minutes=5)).isoformat(), **extra}


async def test_create_edit_delete_pass_with_log(client, auth, race):
    created = await client.post("/api/admin/checkpoint-passes", headers=auth,
                                json=pass_body(race, note="Спутниковый телефон судьи"))
    assert created.status_code == 201
    item = created.json()["data"]
    assert item["entered_by"] == "Иван Иванов"

    duplicate = await client.post("/api/admin/checkpoint-passes", headers=auth, json=pass_body(race))
    assert duplicate.status_code == 409

    departed = (NOW - timedelta(minutes=1)).isoformat()
    edited = await client.patch(f"/api/admin/checkpoint-passes/{item['id']}", headers=auth,
                                json={"departed_at": departed, "expected_updated_at": item["updated_at"]})
    assert edited.status_code == 200 and edited.json()["data"]["departed_at"] is not None

    monitoring = (await client.get(f"/api/admin/stages/{race['stage'].id}/monitoring", headers=auth)).json()
    row14 = next(r for r in monitoring["data"]["rows"] if r["start_number"] == 14)
    assert len(row14["passes"]) == 1

    assert (await client.delete(f"/api/admin/checkpoint-passes/{item['id']}", headers=auth)).status_code == 200
    log = (await client.get(f"/api/admin/stages/{race['stage'].id}/checkpoint-passes/log",
                            headers=auth)).json()["data"]
    assert [entry["action"] for entry in log] == ["delete", "update", "create"]
    assert log[1]["before"]["departed_at"] is None and log[1]["after"]["departed_at"] is not None
    assert all(entry["changed_by"] == "Иван Иванов" for entry in log)


async def test_pass_validation(client, auth, race):
    future = await client.post("/api/admin/checkpoint-passes", headers=auth,
                               json=pass_body(race, arrived_at=(NOW + timedelta(hours=1)).isoformat()))
    assert future.status_code == 422
    backwards = await client.post("/api/admin/checkpoint-passes", headers=auth,
                                  json=pass_body(race, departed_at=(NOW - timedelta(hours=1)).isoformat()))
    assert backwards.status_code == 422
    foreign = await client.post("/api/admin/checkpoint-passes", headers=auth,
                                json=pass_body(race, stage_checkpoint_id=race["foreign_kp"].id))
    assert foreign.status_code == 422
    naive = await client.post("/api/admin/checkpoint-passes", headers=auth,
                              json=pass_body(race, arrived_at="2027-02-18T14:58:00"))
    assert naive.status_code == 422           # время обязательно с часовым поясом
    assert (await client.patch("/api/admin/checkpoint-passes/999999", headers=auth,
                              json={"expected_updated_at": NOW.isoformat()})).status_code == 404


async def test_kamchatka_time_is_stored_as_utc(client, auth, race):
    local = (NOW - timedelta(minutes=5)).astimezone().astimezone(
        __import__("datetime").timezone(timedelta(hours=12)))
    response = await client.post("/api/admin/checkpoint-passes", headers=auth,
                                 json=pass_body(race, arrived_at=local.isoformat()))
    arrived = datetime.fromisoformat(response.json()["data"]["arrived_at"].replace("Z", "+00:00"))
    assert arrived == NOW - timedelta(minutes=5)


async def test_public_passes_have_no_internal_fields(client, auth, race):
    await client.post("/api/admin/checkpoint-passes", headers=auth, json=pass_body(race, note="служебное"))
    response = await client.get(f"/api/race-participants/{race['e14'].id}/checkpoint-passes")
    item = response.json()["data"][0]
    assert (item["label"], item["stage_number"], item["required_rest_minutes"]) == ("КП-2", 2, 60)
    assert "note" not in item and "entered_by" not in item


async def test_concurrent_pass_edit_preserves_winner_and_audit(client, auth, race):
    arrival = (NOW - timedelta(minutes=5)).replace(microsecond=123456).isoformat()
    item = (await client.post("/api/admin/checkpoint-passes", headers=auth,
                             json=pass_body(race, arrived_at=arrival, note="original"))).json()["data"]
    path = f"/api/admin/checkpoint-passes/{item['id']}"
    # The client fixture opens an independent database session for each request.
    responses = await asyncio.gather(*(
        client.patch(path, headers=auth, json={"expected_updated_at": item["updated_at"], "note": note})
        for note in ("judge one", "judge two")
    ))
    assert sorted(r.status_code for r in responses) == [200, 409]
    winner = next(r.json()["data"] for r in responses if r.status_code == 200)
    conflict = next(r.json()["error"] for r in responses if r.status_code == 409)
    assert conflict["code"] == "conflict"
    assert conflict["details"]["current"] == winner
    assert winner["arrived_at"] == item["arrived_at"]
    assert winner["departed_at"] is None
    assert datetime.fromisoformat(winner["updated_at"]) > datetime.fromisoformat(item["updated_at"])
    unchanged = await client.patch(path, headers=auth,
                                   json={"expected_updated_at": winner["updated_at"], "note": winner["note"]})
    assert unchanged.json()["data"] == winner
    monitoring = (await client.get(f"/api/admin/stages/{race['stage'].id}/monitoring", headers=auth)).json()["data"]
    row = next(row for row in monitoring["rows"] if row["race_participant_id"] == item["race_participant_id"])
    assert row["passes"] == [winner]
    logs = (await client.get(f"/api/admin/stages/{race['stage'].id}/checkpoint-passes/log", headers=auth)).json()["data"]
    assert [entry["action"] for entry in logs] == ["update", "create"]
    assert logs[0]["before"]["note"] == "original"
    assert logs[0]["after"]["note"] == winner["note"]


async def test_legacy_pass_edit_requires_refresh(client, auth, race):
    item = (await client.post("/api/admin/checkpoint-passes", headers=auth,
                             json=pass_body(race))).json()["data"]
    response = await client.patch(f"/api/admin/checkpoint-passes/{item['id']}", headers=auth,
                                  json={"note": "unsafe"})
    assert response.status_code == 422
    assert "Обновите страницу" in response.json()["error"]["message"]


# ── SOS ────────────────────────────────────────────────────────────────

async def test_acknowledge_alert(client, auth, race):
    alerts = (await client.get(f"/api/admin/races/{race['race'].id}/alerts", headers=auth)).json()["data"]
    assert len(alerts) == 1
    alert_id = alerts[0]["id"]
    no_reason = await client.post(f"/api/admin/alerts/{alert_id}/acknowledge", headers=auth, json={"note": ""})
    assert no_reason.status_code == 422
    done = await client.post(f"/api/admin/alerts/{alert_id}/acknowledge", headers=auth,
                             json={"note": "Ложное нажатие, каюр на связи"})
    assert done.json()["data"]["acknowledged_by"] == "Иван Иванов"
    again = await client.post(f"/api/admin/alerts/{alert_id}/acknowledge", headers=auth, json={"note": "ещё"})
    assert again.status_code == 409
    assert (await client.get(f"/api/admin/races/{race['race'].id}/alerts", headers=auth)).json()["data"] == []
    history = await client.get(f"/api/admin/races/{race['race'].id}/alerts?active=false", headers=auth)
    assert len(history.json()["data"]) == 1


@pytest.mark.parametrize("status", [StageStatus.PLANNED, StageStatus.LIVE, StageStatus.FINISHED])
async def test_monitoring_never_counts_a_tracker_without_points_as_online(client, session, auth, race, status):
    race["stage"].status = status
    await session.execute(delete(TrackerPosition).where(TrackerPosition.race_participant_id == race["e7"].id))
    await session.commit()
    data = (await client.get(f"/api/admin/stages/{race['stage'].id}/monitoring", headers=auth)).json()["data"]
    row = next(r for r in data["rows"] if r["race_participant_id"] == race["e7"].id)
    assert row["last_position"] is None
    assert row["is_overdue"] is (status == StageStatus.LIVE)
    assert data["summary"]["ok"] == (0 if status == StageStatus.LIVE else 1)
