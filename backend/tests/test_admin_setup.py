"""Админка: гонки, дисциплины, этапы, трек KML/KMZ/GPX, КП, участники, трекеры (3.5)."""

import io
import zipfile

import pytest

from app.models import AdminUser, CheckpointPass, StageCheckpoint
from app.services.admin_auth import hash_password, issue_token
from app.services.route_file import RouteFileError, parse_route

KML = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Этап 1</name><LineString><coordinates>
    158.60,53.10,0 158.62,53.12,0 158.65,53.15,0
  </coordinates></LineString></Placemark>
  <Placemark><name>КП Пиначево</name><Point><coordinates>158.65,53.15,0</coordinates></Point></Placemark>
</Document></kml>"""

GPX = """<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="53.15" lon="158.65"><ele>320</ele><name>КП-1</name></wpt>
  <trk><trkseg>
    <trkpt lat="53.10" lon="158.60"><ele>100</ele></trkpt>
    <trkpt lat="53.12" lon="158.62"><ele>250</ele></trkpt>
    <trkpt lat="53.15" lon="158.65"><ele>320</ele></trkpt>
  </trkseg></trk>
</gpx>"""


@pytest.fixture
async def auth(session):
    admin = AdminUser(login="org", full_name="Организатор", password_hash=hash_password("пароль-123456"))
    session.add(admin)
    await session.commit()
    token, _ = issue_token(admin.id)
    return {"Authorization": f"Bearer {token}"}


def test_route_parsers():
    kml = parse_route(KML.encode())
    assert kml["geojson"]["type"] == "LineString"
    assert kml["geojson"]["coordinates"][0] == [158.60, 53.10]       # высоты 0 → считаем, что их нет
    assert kml["has_elevation"] is False and kml["points"][0]["name"] == "КП Пиначево"

    gpx = parse_route(GPX.encode())
    assert gpx["has_elevation"] is True and gpx["geojson"]["coordinates"][1] == [158.62, 53.12, 250.0]
    assert gpx["points"][0]["elevation_m"] == 320.0

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("doc.kml", KML)
    assert parse_route(buffer.getvalue())["geojson"]["type"] == "LineString"

    for bad in (b"not xml", b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><kml/>',
                b'<kml xmlns="http://www.opengis.net/kml/2.2"></kml>', b"<svg/>"):
        with pytest.raises(RouteFileError):
            parse_route(bad)


async def test_full_setup_flow(client, session, auth):
    race = (await client.post("/api/admin/races", headers=auth,
                              json={"name": "Берингия. Авача 2027", "year": 2027})).json()["data"]
    assert race["status"] == "upcoming"
    assert (await client.post("/api/admin/races", headers=auth,
                              json={"name": "Дубль", "year": 2027})).status_code == 409
    old = (await client.post("/api/admin/races", headers=auth, json={"name": "Авача 2026", "year": 2026})).json()["data"]
    await client.patch(f"/api/admin/races/{old['id']}", headers=auth, json={"is_current": True})
    current = await client.patch(f"/api/admin/races/{race['id']}", headers=auth, json={"is_current": True})
    assert current.json()["data"]["is_current"] is True
    assert (await client.get("/api/races/current")).json()["data"]["id"] == race["id"]

    discipline = (await client.post("/api/admin/disciplines", headers=auth, json={
        "code": "sled_8", "name": "Нарта — 8 собак", "equipment": "sled", "dogs_min": 8, "dogs_max": 8})).json()["data"]
    assert (await client.patch(f"/api/admin/disciplines/{discipline['id']}", headers=auth,
                               json={"dogs_max": 2})).status_code == 422

    stage = (await client.post(f"/api/admin/races/{race['id']}/stages", headers=auth, json={
        "number": 1, "name": "Елизово — Пиначево", "distance_km": 33.7,
        "start_at": "2027-02-06T10:00:00+12:00", "finish_at": "2027-02-06T18:00:00+12:00"})).json()["data"]
    assert stage["start_at"].startswith("2027-02-05T22:00:00")       # хранится в UTC
    assert (await client.post(f"/api/admin/races/{race['id']}/stages", headers=auth,
                              json={"number": 1})).status_code == 409
    backwards = await client.patch(f"/api/admin/stages/{stage['id']}", headers=auth,
                                   json={"finish_at": "2027-02-06T09:00:00+12:00"})
    assert backwards.status_code == 422

    uploaded = await client.put(f"/api/admin/stages/{stage['id']}/route", headers=auth,
                                files={"file": ("etap1.gpx", GPX.encode(), "application/gpx+xml")})
    assert uploaded.status_code == 200
    body = uploaded.json()["data"]
    assert body["has_elevation"] and body["route_source_filename"] == "etap1.gpx" and body["route_length_km"] > 5
    public_stage = (await client.get(f"/api/stages/{stage['id']}")).json()["data"]
    assert len(public_stage["elevation_profile"]) == 3
    replaced = await client.put(f"/api/admin/stages/{stage['id']}/route", headers=auth,
                                files={"file": ("new.kml", KML.encode(), "application/xml")})
    assert replaced.json()["data"]["route_source_filename"] == "new.kml"
    assert (await client.put(f"/api/admin/stages/{stage['id']}/route", headers=auth,
                             files={"file": ("x.kml", b"<kml/>", "application/xml")})).status_code == 422

    place = (await client.post("/api/admin/checkpoints", headers=auth, json={
        "name": "Пиначево", "latitude": 53.15, "longitude": 158.65})).json()["data"]
    kp = (await client.post(f"/api/admin/stages/{stage['id']}/checkpoints", headers=auth, json={
        "checkpoint_id": place["id"], "order_index": 1, "label": "КП-1", "km_from_start": 12.5,
        "required_rest_minutes": 60})).json()["data"]
    assert (await client.post(f"/api/admin/stages/{stage['id']}/checkpoints", headers=auth, json={
        "checkpoint_id": place["id"], "order_index": 1})).status_code == 409

    entry = (await client.post(f"/api/admin/races/{race['id']}/participants", headers=auth, json={
        "last_name": "Шевчук", "first_name": "Георгий", "birth_year": 1993, "discipline_id": discipline["id"],
        "start_number": 18, "region": "Камчатский край", "dogs_count": 8, "bio": "Победитель 2026"})).json()["data"]
    assert entry["participant"]["full_name"] == "Шевчук Георгий"
    taken = await client.post(f"/api/admin/races/{race['id']}/participants", headers=auth, json={
        "last_name": "Другой", "first_name": "Каюр", "discipline_id": discipline["id"], "start_number": 18})
    assert taken.status_code == 409
    photo = await client.patch(f"/api/admin/participants/{entry['participant']['id']}", headers=auth,
                               json={"photo_url": "https://example.ru/shevchuk.jpg"})
    assert photo.json()["data"]["photo_url"].endswith("shevchuk.jpg")
    card = (await client.get(f"/api/participants/{entry['participant']['id']}")).json()["data"]
    assert card["bio"] == "Победитель 2026"

    tracker = (await client.post("/api/admin/trackers", headers=auth,
                                 json={"imei": "300234063471014", "name": "Трекер 14"})).json()["data"]
    assigned = (await client.post(f"/api/admin/trackers/{tracker['id']}/assign", headers=auth,
                                  json={"race_participant_id": entry["id"]})).json()["data"]
    assert assigned["assigned_to"]["start_number"] == 18 and assigned["is_active"]
    released = (await client.post(f"/api/admin/trackers/{tracker['id']}/unassign", headers=auth)).json()["data"]
    assert released["assigned_to"] is None

    # КП с отметкой судьи не удаляется; этап с КП без протоколов — удаляется.
    session.add(CheckpointPass(race_participant_id=entry["id"], stage_checkpoint_id=kp["id"],
                               arrived_at=__import__("datetime").datetime(2027, 2, 6, tzinfo=__import__("datetime").UTC)))
    await session.commit()
    assert (await client.delete(f"/api/admin/stage-checkpoints/{kp['id']}", headers=auth)).status_code == 409
    assert (await client.delete(f"/api/admin/race-participants/{entry['id']}", headers=auth)).status_code == 409


async def test_stage_start_sends_push_to_all(client, session, auth, monkeypatch):
    import httpx

    from app.config import get_settings
    from app.models import AppUser
    from app.services import vk_api

    sent = []
    monkeypatch.setattr(vk_api, "transport", httpx.MockTransport(lambda r: (
        sent.append(dict(httpx.QueryParams(r.content.decode()))),
        httpx.Response(200, json={"response": [{"user_id": 7, "status": True}]}))[1]))
    monkeypatch.setattr(get_settings(), "vk_service_token", "token")
    session.add_all([AppUser(vk_user_id=7, notifications_allowed=True), AppUser(vk_user_id=8)])
    await session.commit()
    race = (await client.post("/api/admin/races", headers=auth, json={"name": "А", "year": 2030})).json()["data"]
    stage = (await client.post(f"/api/admin/races/{race['id']}/stages", headers=auth, json={
        "number": 2, "start_at": "2030-02-08T09:00:00+12:00"})).json()["data"]
    await client.patch(f"/api/admin/stages/{stage['id']}", headers=auth, json={"status": "live"})
    assert len(sent) == 1 and sent[0]["user_ids"] == "7"
    assert "09:00 по Камчатке" in sent[0]["message"]
    history = (await client.get("/api/admin/push", headers=auth)).json()["data"]
    assert history[0]["trigger"] == "stage_start" and history[0]["delivered"] == 1
    await client.patch(f"/api/admin/stages/{stage['id']}", headers=auth, json={"name": "Переименован"})
    assert len(sent) == 1                                            # повторно не шлём


async def test_poll_now_without_key(client, auth, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "iridium360_api_key", "")
    assert (await client.post("/api/admin/trackers/poll", headers=auth)).status_code == 503
