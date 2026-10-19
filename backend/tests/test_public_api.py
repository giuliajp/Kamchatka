"""Публичный API: гонки, участники, этапы, общий зачёт (задачи 2.3–2.5).

Основа — настоящий итоговый протокол «Авача-2026» из docs/.
"""

from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select, update

from app.models import (
    Checkpoint, CheckpointRole, Protocol, Race, RaceStatus, Stage, StageCheckpoint, StageResult,
)
from app.services.protocol_import import import_protocol
from app.services.route_profile import elevation_profile
from app.services.standings import format_duration
from scripts.parse_protocol import parse_protocol

PDF = Path(__file__).resolve().parents[2] / "docs" / "Total_result_Avacha-2026.pdf"

# Итоговые места и время из PDF-протокола 2026 (по стартовым номерам).
EXPECTED_2026 = {
    "ski_2": [(1, 4, "22:33:44"), (2, 3, "29:07:47"), (3, 2, "30:11:28"), (4, 5, "37:11:47")],
    "sled_8": [(1, 11, "20:22:12"), (2, 9, "20:23:50"), (3, 8, "21:17:13"),
               (4, 6, "24:02:19"), (5, 7, "27:39:45")],
    "sled_8plus": [(1, 18, "18:25:10"), (2, 13, "19:37:07"), (3, 21, "20:28:26"),
                   (4, 16, "20:54:51"), (5, 14, "21:20:31"), (6, 17, "21:24:01"),
                   (7, 19, "23:27:17"), (8, 12, "24:32:42"), (9, 15, "25:42:55"),
                   (10, 20, "27:08:02")],
}


@pytest.fixture(scope="module")
def archive_document():
    return parse_protocol(PDF)


async def load_2026(session, document, publish=True) -> int:
    async with session.begin():
        result = await import_protocol(session, deepcopy(document))
    if publish:
        async with session.begin():
            await session.execute(update(Protocol).values(published_at=datetime.now(UTC)))
    return result.race_id


def rows_by_discipline(body):
    return {d["discipline"]["code"]: d["rows"] for d in body["data"]["disciplines"]}


# ── Общий зачёт ────────────────────────────────────────────────────────

async def test_results_match_official_2026_protocol(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    response = await client.get(f"/api/races/{race_id}/results")
    assert response.status_code == 200
    rows = rows_by_discipline(response.json())

    # Три отдельные таблицы, общего зачёта между дисциплинами нет.
    assert list(rows) == ["ski_2", "sled_8", "sled_8plus"]
    for code, expected in EXPECTED_2026.items():
        placed = [(r["place"], r["start_number"], r["total_time"])
                  for r in rows[code] if r["place"] is not None]
        assert placed == expected, code


async def test_penalties_listed_and_not_added_twice(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    body = (await client.get(f"/api/races/{race_id}/results?discipline=sled_8plus")).json()
    assert body["data"]["penalty_included_in_stage_times"] is True
    leader = rows_by_discipline(body)["sled_8plus"][0]
    assert leader["start_number"] == 18
    assert leader["total_time"] == "18:25:10"          # как в протоколе, без +2 мин
    assert leader["penalty_total_seconds"] == 120
    assert leader["penalties"][0]["rule_reference"] == "П.14.11.14"
    assert leader["gap_to_leader_seconds"] == 0


async def test_dnf_and_dns_stay_last_without_place(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    rows = rows_by_discipline((await client.get(f"/api/races/{race_id}/results")).json())

    ski_last = rows["ski_2"][-1]
    assert (ski_last["start_number"], ski_last["place"], ski_last["status"]) == (1, None, "dnf")
    assert [c["status"] for c in ski_last["stages"]] == ["dnf"] + [None] * 5

    sled_last = rows["sled_8"][-1]
    assert (sled_last["start_number"], sled_last["status"]) == (10, "dns")
    assert sled_last["stages"][0]["time"] == "03:09:14"
    assert sled_last["stages"][3]["time"] is None     # фронтенд покажет «—»


async def test_unpublished_protocols_are_hidden(client, session, archive_document):
    race_id = await load_2026(session, archive_document, publish=False)
    body = (await client.get(f"/api/races/{race_id}/results")).json()
    for discipline in body["data"]["disciplines"]:
        assert discipline["stages"] == []
        assert all(r["place"] is None and r["stages"] == [] for r in discipline["rows"])
        assert len(discipline["rows"]) > 0          # участники всё равно видны


async def test_results_after_stage(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    body = (await client.get(f"/api/races/{race_id}/results?stage=1&discipline=sled_8plus")).json()
    discipline = body["data"]["disciplines"][0]
    assert [s["number"] for s in discipline["stages"]] == [1]
    leader = discipline["rows"][0]
    assert (leader["start_number"], leader["total_time"]) == (18, "02:10:02")


async def test_judge_place_wins_over_calculation(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    async with session.begin():
        stage6 = await session.scalar(select(Stage.id).where(Stage.number == 6))
        protocol_ids = select(Protocol.id).where(Protocol.stage_id == stage6)
        await session.execute(
            update(StageResult).where(StageResult.protocol_id.in_(protocol_ids),
                                      StageResult.place == 2).values(place=7)
        )
    rows = rows_by_discipline((await client.get(f"/api/races/{race_id}/results")).json())
    by_number = {r["start_number"]: r["place"] for r in rows["sled_8plus"]}
    assert by_number[13] == 7


async def test_stage_protocols(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    stage3 = await session.scalar(select(Stage.id).where(Stage.race_id == race_id,
                                                         Stage.number == 3))
    body = (await client.get(f"/api/stages/{stage3}/protocols")).json()["data"]
    assert body["stage"]["number"] == 3
    assert [p["discipline"]["code"] for p in body["protocols"]] == ["ski_2", "sled_8", "sled_8plus"]
    sled_8 = body["protocols"][1]
    assert sled_8["chief_judge"].startswith("Отбеткин")
    assert sled_8["rows"][0]["start_number"] == 9      # после 3 этапов лидировала Семашкина
    assert sled_8["rows"][0]["total_time"] == "12:01:43"


# ── Участники ──────────────────────────────────────────────────────────

async def test_participants_sort_by_place_stays_inside_disciplines(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    items = (await client.get(f"/api/races/{race_id}/participants?sort=place")).json()["data"]
    assert len(items) == 21
    codes = [i["discipline"]["code"] for i in items]
    assert codes == sorted(codes, key=["ski_2", "sled_8", "sled_8plus"].index)
    assert [i["place"] for i in items[:5]] == [1, 2, 3, 4, None]


async def test_participants_filter_and_search(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    sled = (await client.get(f"/api/races/{race_id}/participants?discipline=sled_8")).json()["data"]
    assert [i["start_number"] for i in sled] == [6, 7, 8, 9, 10, 11]

    found = (await client.get(f"/api/races/{race_id}/participants?q=семашк")).json()["data"]
    assert {i["start_number"] for i in found} == {9, 17, 21}
    by_number = (await client.get(f"/api/races/{race_id}/participants?q=18")).json()["data"]
    assert [i["last_name"] for i in by_number] == ["Шевчук"]


async def test_participant_card(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    items = (await client.get(f"/api/races/{race_id}/participants?q=18")).json()["data"]
    card = (await client.get(f"/api/participants/{items[0]['participant_id']}")).json()["data"]
    assert card["full_name"] == "Шевчук Георгий Геннадьевич"
    assert "birth_year" not in card
    entry = card["races"][0]
    assert (entry["race"]["year"], entry["place"], entry["total_time"]) == (2026, 1, "18:25:10")
    assert entry["penalty_total_seconds"] == 120


async def test_participant_not_found(client):
    body = (await client.get("/api/participants/999999")).json()
    assert body["error"]["code"] == "not_found"


# ── Гонки и этапы ──────────────────────────────────────────────────────

async def test_races_and_current(client, session, archive_document):
    race_id = await load_2026(session, archive_document)
    races = (await client.get("/api/races")).json()["data"]
    assert [r["year"] for r in races] == [2026]

    current = (await client.get("/api/races/current")).json()["data"]
    assert current["id"] == race_id
    assert [d["participants_count"] for d in current["disciplines"]] == [5, 6, 10]
    assert [s["number"] for s in current["stages"]] == [1, 2, 3, 4, 5, 6]

    async with session.begin():
        session.add(Race(name="Берингия. Авача 2027", year=2027, status=RaceStatus.UPCOMING))
    current = (await client.get("/api/races/current")).json()["data"]
    assert current["year"] == 2027                     # самая свежая, если нет отметки
    async with session.begin():
        await session.execute(update(Race).where(Race.year == 2026).values(is_current=True))
    assert (await client.get("/api/races/current")).json()["data"]["year"] == 2026


async def test_no_races(client):
    response = await client.get("/api/races/current")
    assert response.status_code == 404


async def test_stage_route_and_profile(client, session):
    async with session.begin():
        race = Race(name="Тест", year=2030)
        stage = Stage(race=race, number=1, name="Пиначево — Центральный кордон", route_geojson={
            "type": "LineString",
            "coordinates": [[158.0, 53.0, 100.0], [158.0, 53.01, 250.0], [158.0, 53.02, 180.0]],
        })
        start = Checkpoint(name="Пиначево", latitude=53.0, longitude=158.0)
        finish = Checkpoint(name="Центральный кордон", latitude=53.02, longitude=158.0)
        session.add_all([
            StageCheckpoint(stage=stage, checkpoint=finish, order_index=1,
                            role=CheckpointRole.FINISH, km_from_start=2.2),
            StageCheckpoint(stage=stage, checkpoint=start, order_index=0,
                            role=CheckpointRole.START, km_from_start=0),
        ])
    body = (await client.get(f"/api/stages/{stage.id}")).json()["data"]
    assert [c["name"] for c in body["checkpoints"]] == ["Пиначево", "Центральный кордон"]
    assert [p["elevation_m"] for p in body["elevation_profile"]] == [100.0, 250.0, 180.0]
    assert body["elevation_profile"][-1]["km"] == pytest.approx(2.224, abs=0.01)

    stages = (await client.get(f"/api/races/{race.id}/stages")).json()["data"]
    assert [s["name"] for s in stages] == ["Пиначево — Центральный кордон"]


# ── Мелкие функции ─────────────────────────────────────────────────────

def test_format_duration():
    assert format_duration(None) is None
    assert format_duration(3) == "00:00:03"
    assert format_duration(104867) == "29:07:47"


def test_elevation_profile_without_heights_is_empty():
    line = {"type": "LineString", "coordinates": [[158.0, 53.0], [158.1, 53.1]]}
    assert elevation_profile(line) == []
    assert elevation_profile(None) == []
    feature = {"type": "Feature", "geometry": {"type": "LineString",
                                               "coordinates": [[1, 1, 5], [1, 1, 7]]}}
    assert [p["elevation_m"] for p in elevation_profile(feature)] == [5.0, 7.0]
