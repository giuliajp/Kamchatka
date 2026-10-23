"""Iridium360: разбор ответа, клиент, цикл опроса (задача 2.6).

Живого ответа Iridium ещё не видели — формат взят из документации api.iridium360.ru.
Сеть в тестах не используется: клиент получает «поддельный» транспорт или поддельного клиента.
"""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import (
    Discipline, Equipment, Participant, Race, RaceParticipant, Stage, TrackerAssignment,
    TrackerDevice, TrackerPosition,
)
from app.services.iridium360.client import (
    Iridium360Client, Iridium360Error, IridiumDevice, IridiumPoint, parse_datetime, parse_devices,
)
from app.services.iridium360.ingest import poll_once

T0 = datetime(2027, 2, 7, 2, 0, tzinfo=UTC)
IMEI = "300234010000018"


# ── Разбор ответа ──────────────────────────────────────────────────────

@pytest.mark.parametrize("raw", [
    "2027-02-07T02:00:00", "2027-02-07T02:00:00Z", "2027-02-07T14:00:00+12:00",
    "07.02.2027 02:00:00", "/Date(1801965600000)/", 1801965600000, 1801965600,
])
def test_parse_datetime_formats(raw):
    assert parse_datetime(raw) == T0


def test_parse_datetime_garbage():
    assert parse_datetime(None) is None
    assert parse_datetime("вчера") is None


def test_parse_devices_as_in_documentation():
    payload = [{
        "Name": "Трекер 18", "Number": 18, "Imei": IMEI,
        "LastKnownPosition": {"Id": 501, "Date": "2027-02-07T02:00:00", "Lat": 53.1,
                              "Lon": 158.7, "Cog": 90, "Sog": 14.5, "Alt": 320, "Battery": 87},
        "Track": {"Points": [
            {"Id": 500, "Date": "2027-02-07T01:40:00", "Lat": 53.0, "Lon": 158.6},
            {"Id": 499, "Date": "2027-02-07T01:20:00", "Lat": 0, "Lon": 0},   # мусор
        ]},
    }]
    device = parse_devices(payload)[0]
    assert (device.imei, device.number, device.name) == (IMEI, "18", "Трекер 18")
    assert device.last_position == IridiumPoint("501", T0, 53.1, 158.7, 90, 14.5, 320, 87)
    assert [p.id for p in device.track] == ["500"]


def test_parse_devices_tolerates_lowercase_and_missing_position():
    devices = parse_devices([{"imei": IMEI, "lastKnownPosition": None}, {"Name": "без IMEI"}])
    assert len(devices) == 1 and devices[0].last_position is None


def test_parse_devices_error_body():
    with pytest.raises(Iridium360Error, match="Unknown error"):
        parse_devices({"error": "Unknown error"})


# ── Клиент ─────────────────────────────────────────────────────────────

def make_client(handler) -> Iridium360Client:
    client = Iridium360Client(transport=httpx.MockTransport(handler))
    client.api_key = "secret-key"
    client.RETRY_DELAY = 0
    return client


async def test_client_sends_token_and_track_params():
    seen = []

    def handler(request):
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=[{"Imei": IMEI, "Number": "18", "Track": {"Points": [
            {"Id": 7, "Date": "2027-02-07T02:00:00", "Lat": 53.1, "Lon": 158.7}]}}])

    async with make_client(handler) as client:
        points = await client.fetch_track("18", point_id_from="5")
    assert seen[0] == {"token": "secret-key", "number": "18", "include_track": "true",
                       "point_id_from": "5"}
    assert [p.id for p in points] == ["7"]


async def test_client_server_error_hides_key():
    def handler(request):
        return httpx.Response(500, json={"error": "Unknown error"})

    async with make_client(handler) as client:
        with pytest.raises(Iridium360Error) as error:
            await client.fetch_devices()
    assert "500" in str(error.value) and "Unknown error" in str(error.value)
    assert "secret-key" not in str(error.value)


async def test_client_retries_on_connection_error():
    calls = []

    def handler(request):
        calls.append(1)
        if len(calls) < 3:
            raise httpx.ConnectError("Could not connect to server")
        return httpx.Response(200, json=[])

    async with make_client(handler) as client:
        assert await client.fetch_devices() == []
    assert len(calls) == 3


async def test_client_without_key():
    client = Iridium360Client(transport=httpx.MockTransport(lambda r: httpx.Response(200)))
    client.api_key = ""
    async with client:
        with pytest.raises(Iridium360Error, match="IRIDIUM360_API_KEY"):
            await client.fetch_devices()


# ── Цикл опроса ────────────────────────────────────────────────────────

class FakeClient:
    """Подмена Iridium360Client: отдаёт заранее заданные устройства и треки."""

    def __init__(self, devices=None, track=None, error=None):
        self.devices, self.track, self.error = devices or [], track or [], error
        self.device_calls, self.track_calls = 0, []

    async def fetch_devices(self):
        self.device_calls += 1
        if self.error:
            raise Iridium360Error(self.error)
        return self.devices

    async def fetch_track(self, number, point_id_from=None, **kwargs):
        self.track_calls.append((number, point_id_from))
        return self.track


def point(point_id, minutes, lat=53.1):
    return IridiumPoint(str(point_id), T0 + timedelta(minutes=minutes), lat, 158.7, None, 12.0, 300, 80)


def device(*points, imei=IMEI):
    return IridiumDevice("Трекер 18", "18", imei, points[-1] if points else None)


@pytest.fixture
def maker(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def setup(maker):
    """Гонка 2027, этап 1 стартовал в T0, у участника №18 — трекер на всю гонку."""
    async with maker.begin() as session:
        race = Race(name="Берингия. Авача 2027", year=2027)
        sled = Discipline(code="sled_8plus", name="Нарта 8+", equipment=Equipment.SLED, dogs_min=9)
        stage = Stage(race=race, number=1, start_at=T0 - timedelta(hours=1),
                      finish_at=T0 + timedelta(hours=10))
        entry = RaceParticipant(race=race, discipline=sled, start_number=18,
                                participant=Participant(last_name="Шевчук", first_name="Георгий"))
        tracker = TrackerDevice(imei=IMEI, name="Трекер 18")
        session.add_all([race, sled, stage, entry, tracker,
                         TrackerAssignment(tracker_device=tracker, race_participant=entry,
                                           valid_from=T0 - timedelta(days=1))])
    return {"entry_id": entry.id, "stage_id": stage.id, "device_id": tracker.id}


async def positions(maker):
    async with maker() as session:
        return list((await session.execute(
            select(TrackerPosition).order_by(TrackerPosition.position_at))).scalars())


async def test_poll_saves_point_with_participant_and_stage(maker, setup):
    report = await poll_once(maker, FakeClient([device(point(1, 0))]), now=T0)
    assert (report.points_received, report.points_saved, report.errors) == (1, 1, [])

    [saved] = await positions(maker)
    assert saved.race_participant_id == setup["entry_id"]
    assert saved.stage_id == setup["stage_id"]
    assert (saved.external_point_id, saved.position_at, saved.battery_percent) == ("1", T0, 80)


async def test_poll_twice_no_duplicates(maker, setup):
    client = FakeClient([device(point(1, 0))])
    await poll_once(maker, client, now=T0)
    report = await poll_once(maker, client, now=T0)
    assert report.points_saved == 0
    assert len(await positions(maker)) == 1
    assert client.track_calls == []          # точка та же — трек не догружаем


async def test_poll_fills_gap_from_last_saved_point(maker, setup):
    await poll_once(maker, FakeClient([device(point(1, 0))]), now=T0)
    # Пока Iridium был недоступен, трекер передал точки 2 и 3.
    client = FakeClient([device(point(3, 40))], track=[point(1, 0), point(2, 20), point(3, 40)])
    report = await poll_once(maker, client, now=T0)
    assert client.track_calls == [("18", "1")]
    assert report.points_saved == 2
    assert [p.external_point_id for p in await positions(maker)] == ["1", "2", "3"]


async def test_unknown_device_created_inactive_without_points(maker, setup):
    other = "300234010000099"
    report = await poll_once(maker, FakeClient([device(point(9, 0), imei=other)]), now=T0)
    assert report.new_devices == [other]
    assert await positions(maker) == []
    async with maker() as session:
        new = await session.scalar(select(TrackerDevice).where(TrackerDevice.imei == other))
    assert new.is_active is False


async def test_point_before_assignment_is_not_saved(maker, setup):
    report = await poll_once(maker, FakeClient([device(point(1, -60 * 48))]), now=T0)
    assert (report.points_unassigned, report.points_saved) == (1, 0)


async def test_no_assignments_no_requests(maker):
    client = FakeClient([device(point(1, 0))])
    report = await poll_once(maker, client, now=T0)
    assert report.skipped and client.device_calls == 0


async def test_iridium_error_does_not_raise(maker, setup):
    report = await poll_once(maker, FakeClient(error="Iridium360 ответил 500: Unknown error"), now=T0)
    assert report.errors and report.points_saved == 0
    assert "500" in report.summary()


async def test_stage_from_assignment_wins(maker, setup):
    async with maker.begin() as session:
        stage2 = Stage(race_id=(await session.get(Stage, setup["stage_id"])).race_id, number=2)
        session.add(stage2)
        await session.flush()
        session.add(TrackerAssignment(tracker_device_id=setup["device_id"],
                                      race_participant_id=setup["entry_id"], stage_id=stage2.id,
                                      valid_from=T0 - timedelta(hours=2)))
    await poll_once(maker, FakeClient([device(point(1, 0))]), now=T0)
    [saved] = await positions(maker)
    assert saved.stage_id == stage2.id
    async with maker() as session:
        assert await session.scalar(select(func.count()).select_from(TrackerPosition)) == 1


def test_parse_devices_real_layout_imei_in_number():
    """Живой ответ (окт. 2026): Imei = метка «YB#26571», Number = настоящий IMEI."""
    payload = [{"Name": "Иридиум360° РокСТАР 26571", "Imei": "YB#26571",
                "Number": "300534062293860",
                "LastKnownPosition": {"Id": 1, "Date": "2026-03-25T09:30:00",
                                      "Lat": 57.14099, "Lon": 161.44705, "Battery": 68}}]
    device = parse_devices(payload)[0]
    assert (device.imei, device.number) == ("300534062293860", "300534062293860")
    assert device.name == "Иридиум360° РокСТАР 26571"


async def test_fetch_track_picks_requested_device():
    def handler(request):
        return httpx.Response(200, json=[
            {"Imei": "YB#1", "Number": "300534000000001"},
            {"Imei": "YB#2", "Number": "300534000000002", "Track": {"Points": [
                {"Id": 5, "Date": "2027-02-07T02:00:00", "Lat": 53.1, "Lon": 158.7}]}},
        ])

    async with make_client(handler) as client:
        points = await client.fetch_track("300534000000002")
    assert [p.id for p in points] == ["5"]
