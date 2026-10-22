"""Карта: позиции участников и треки по трекерам (задача 3.1)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models import (
    Discipline, Equipment, Participant, Protocol, Race, RaceParticipant, Stage, StageStatus,
    TrackerDevice, TrackerPosition,
)
from app.services.positions import pick_stage
from app.services.route_progress import Route

NOW = datetime.now(UTC).replace(microsecond=0)
# Трасса этапа: строго на север по меридиану 158°, от 53.00° до 53.30° (≈ 33,4 км).
ROUTE = {"type": "LineString", "coordinates": [[158.0, 53.0 + i * 0.01, 100.0] for i in range(31)]}
KM_PER_DEG = 111.195


@pytest.fixture
async def race(session):
    race = Race(name="Берингия. Авача 2027", year=2027)
    sled = Discipline(code="sled_8plus", name="Нарта 8+", equipment=Equipment.SLED, dogs_min=9,
                      sort_order=2)
    ski = Discipline(code="ski_2", name="Лыжи", equipment=Equipment.SKI, dogs_min=1, sort_order=0)
    stage1 = Stage(race=race, number=1, status=StageStatus.LIVE, route_geojson=ROUTE,
                   start_at=NOW - timedelta(hours=3))
    stage2 = Stage(race=race, number=2)

    def entry(number, name, discipline):
        return RaceParticipant(race=race, discipline=discipline, start_number=number,
                               participant=Participant(last_name=name, first_name="Тест"))

    a, b, c, d = entry(18, "Шевчук", sled), entry(13, "Попов", sled), entry(4, "Филимонова", ski), \
        entry(20, "Бородай", sled)
    session.add_all([race, sled, ski, stage1, stage2, a, b, c, d])
    await session.flush()

    def track(e, *points):
        device = TrackerDevice(imei=f"30023401000{e.start_number:04d}")
        session.add(device)
        for minutes_ago, lat in points:
            session.add(TrackerPosition(
                tracker_device=device, race_participant_id=e.id, stage_id=stage1.id,
                position_at=NOW - timedelta(minutes=minutes_ago), latitude=lat, longitude=158.0,
                altitude_m=150, battery_percent=55, device_speed_kmh=99))

    track(a, (40, 53.05), (20, 53.10), (60, 53.02))   # три точки — берём две последние
    track(b, (70, 53.03), (50, 53.08))                 # последняя 50 мин назад → неактуально
    track(c, (10, 53.04))
    await session.commit()
    return {"race": race, "stage1": stage1, "stage2": stage2, "a": a, "b": b, "c": c, "d": d,
            "sled": sled}


def by_number(body):
    return {p["start_number"]: p for p in body["data"]["participants"]}


async def test_positions_current_stage(client, race):
    response = await client.get(f"/api/races/{race['race'].id}/positions")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["stage"]["number"] == 1
    assert (data["tracking_interval_minutes"], data["stale_after_minutes"]) == (20, 45)
    assert data["route_length_km"] == pytest.approx(0.30 * KM_PER_DEG, abs=0.1)

    p = by_number(response.json())
    a = p[18]
    assert a["position"]["latitude"] == 53.10
    assert a["previous_position"]["latitude"] == 53.05
    assert a["km_on_route"] == pytest.approx(0.10 * KM_PER_DEG, abs=0.05)
    # средняя скорость между двумя последними точками: 5,56 км за 20 мин ≈ 16,7 км/ч
    assert a["avg_speed_kmh"] == pytest.approx(16.7, abs=0.2)
    assert a["is_stale"] is False


async def test_gps_rank_inside_discipline(client, race):
    p = by_number((await client.get(f"/api/races/{race['race'].id}/positions")).json())
    assert (p[18]["gps_rank"], p[13]["gps_rank"]) == (1, 2)
    assert p[13]["gap_to_leader_km"] == pytest.approx(0.02 * KM_PER_DEG, abs=0.05)
    assert p[4]["gps_rank"] == 1                      # лыжи — свой зачёт
    assert p[20]["position"] is None and p[20]["gps_rank"] is None


async def test_stale_position(client, race):
    p = by_number((await client.get(f"/api/races/{race['race'].id}/positions")).json())
    assert p[13]["is_stale"] is True
    assert p[4]["avg_speed_kmh"] is None              # одна точка — скорости нет


async def test_no_battery_or_device_speed_in_public_api(client, race):
    text = (await client.get(f"/api/races/{race['race'].id}/positions")).text
    assert "battery" not in text and "device_speed" not in text and "imei" not in text.lower()


async def test_positions_filter_and_other_stage(client, race):
    rid = race["race"].id
    sled = by_number((await client.get(f"/api/races/{rid}/positions?discipline=sled_8plus")).json())
    assert set(sled) == {18, 13, 20}
    stage2 = (await client.get(f"/api/races/{rid}/positions?stage=2")).json()["data"]
    assert stage2["stage"]["number"] == 2
    assert all(p["position"] is None for p in stage2["participants"])
    assert (await client.get(f"/api/races/{rid}/positions?stage=9")).status_code == 404
    assert (await client.get("/api/races/999999/positions")).status_code == 404


async def test_official_protocol_flag(client, session, race):
    session.add(Protocol(stage_id=race["stage1"].id, discipline_id=race["sled"].id,
                         published_at=NOW))
    await session.commit()
    data = (await client.get(f"/api/races/{race['race'].id}/positions")).json()["data"]
    assert data["official_protocol_disciplines"] == ["sled_8plus"]


async def test_participant_track(client, race):
    body = (await client.get(f"/api/race-participants/{race['a'].id}/track")).json()["data"]
    assert body["start_number"] == 18
    assert [p["latitude"] for p in body["points"]] == [53.02, 53.05, 53.10]   # по времени
    assert {p["stage_number"] for p in body["points"]} == {1}
    empty = (await client.get(f"/api/race-participants/{race['a'].id}/track?stage=2")).json()
    assert empty["data"]["points"] == []
    assert (await client.get("/api/race-participants/999999/track")).status_code == 404


# ── Мелкие функции ─────────────────────────────────────────────────────

def test_route_locate():
    route = Route(ROUTE)
    on = route.locate(53.15, 158.001)
    assert on.km == pytest.approx(0.15 * KM_PER_DEG, abs=0.05)
    assert on.off_route_km == pytest.approx(0.067, abs=0.01)
    assert route.locate(53.15, 158.5) is None         # 33 км в стороне — не на трассе
    assert Route(None).locate(53.1, 158.0) is None


def test_pick_stage():
    s1 = Stage(number=1, status=StageStatus.FINISHED, start_at=NOW - timedelta(days=2))
    s2 = Stage(number=2, status=StageStatus.PLANNED, start_at=NOW - timedelta(hours=1))
    s3 = Stage(number=3, status=StageStatus.PLANNED, start_at=NOW + timedelta(days=1))
    assert pick_stage([s1, s2, s3], NOW, None) is s2      # последний начавшийся
    assert pick_stage([s1, s2, s3], NOW, 3) is s3
    s3.status = StageStatus.LIVE
    assert pick_stage([s1, s2, s3], NOW, None) is s3      # «идёт» важнее
    assert pick_stage([], NOW, None) is None
