"""Публичный контент: публикация, порядок, локации, формат ответов и Swagger."""

from datetime import datetime, timedelta, timezone

import pytest

from app.models import FaqItem, ProgramEvent, SpectatorLocation

START = datetime(2027, 2, 6, 12, tzinfo=timezone(timedelta(hours=12)))


@pytest.mark.parametrize("path,model,fields", [
    ("/api/program", ProgramEvent, {"title": "Открытие", "start_at": START}),
    ("/api/faq", FaqItem, {"question": "Что взять?", "answer": "Тёплую одежду."}),
    ("/api/locations", SpectatorLocation,
     {"name": "Стартовая площадка", "latitude": 53.05, "longitude": 158.65}),
])
async def test_empty_sections_and_publication_changes(client, session, path, model, fields):
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == {"data": [], "error": None}

    item = model(**fields)
    session.add(item)
    await session.commit()
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == {"data": [], "error": None}

    item.is_published = True
    await session.commit()
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json()["error"] is None
    assert [row["id"] for row in response.json()["data"]] == [item.id]

    item.is_published = False
    await session.commit()
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == {"data": [], "error": None}


async def test_program_order_utc_and_shared_location(client, session):
    location = SpectatorLocation(
        name="Стартовая площадка", latitude=53.05, longitude=158.65,
        description="Место для зрителей", address="Камчатка",
        how_to_get_there="На автобусе", is_published=True,
    )
    late = ProgramEvent(
        id=50, title="На следующий день", start_at=START + timedelta(days=1),
        location=location, is_published=True,
    )
    high_order = ProgramEvent(
        id=30, title="Порядок 7", start_at=START + timedelta(hours=1),
        sort_order=7, is_published=True,
    )
    low_order = ProgramEvent(
        id=20, title="Порядок 1", start_at=START + timedelta(hours=1),
        sort_order=1, is_published=True,
    )
    tied = ProgramEvent(
        id=10, title="Тот же порядок, меньший ID", start_at=START + timedelta(hours=1),
        sort_order=1, is_published=True,
    )
    early = ProgramEvent(
        id=40, title="Открытие", description="Начало фестиваля", start_at=START,
        end_at=START + timedelta(minutes=30), sort_order=99,
        location=location, is_published=True,
    )
    hidden = ProgramEvent(id=60, title="Черновик", start_at=START - timedelta(days=1))
    # При одинаковом времени и порядке меньший ID должен оказаться первым,
    # даже если запись была добавлена позже.
    session.add_all([late, high_order, low_order, tied, early, hidden])
    await session.commit()

    response = await client.get("/api/program")
    assert response.status_code == 200
    assert response.json()["error"] is None
    rows = response.json()["data"]
    assert [row["id"] for row in rows] == [early.id, tied.id, low_order.id, high_order.id, late.id]
    assert rows[0]["description"] == "Начало фестиваля"
    assert set(rows[0]) == {
        "id", "title", "description", "start_at", "end_at", "location", "sort_order",
    }
    start_at = datetime.fromisoformat(rows[0]["start_at"])
    end_at = datetime.fromisoformat(rows[0]["end_at"])
    assert start_at == START
    assert end_at == START + timedelta(minutes=30)
    assert start_at.utcoffset() == end_at.utcoffset() == timedelta(0)
    assert rows[1]["description"] is None
    assert rows[1]["end_at"] is None
    assert rows[1]["location"] is None

    response = await client.get("/api/locations")
    assert response.status_code == 200
    published_location = response.json()["data"][0]
    assert rows[0]["location"] == rows[-1]["location"] == published_location
    assert published_location == {
        "id": location.id, "name": "Стартовая площадка",
        "description": "Место для зрителей", "latitude": 53.05, "longitude": 158.65,
        "address": "Камчатка", "how_to_get_there": "На автобусе", "sort_order": 0,
    }


async def test_program_location_follows_publication_and_deletion(client, session):
    location = SpectatorLocation(name="Черновик площадки", latitude=53.05, longitude=158.65)
    event = ProgramEvent(title="Опубликованное событие", start_at=START,
                         location=location, is_published=True)
    session.add(event)
    await session.commit()

    response = await client.get("/api/program")
    assert response.status_code == 200
    original_rows = response.json()["data"]
    assert len(original_rows) == 1
    assert original_rows[0]["id"] == event.id
    assert original_rows[0]["location"] is None
    assert "Черновик площадки" not in response.text
    assert (await client.get("/api/locations")).json()["data"] == []

    location.is_published = True
    await session.commit()
    visible_rows = (await client.get("/api/program")).json()["data"]
    assert visible_rows[0]["location"]["id"] == location.id
    assert visible_rows[0]["location"]["name"] == "Черновик площадки"

    location.is_published = False
    await session.commit()
    assert (await client.get("/api/program")).json()["data"] == original_rows

    await session.delete(location)
    await session.commit()
    assert (await client.get("/api/program")).json()["data"] == original_rows
    assert (await client.get("/api/locations")).json()["data"] == []


@pytest.mark.parametrize("path,model,fields", [
    ("/api/faq", FaqItem, {"question": "Что взять?", "answer": "Тёплую одежду."}),
    ("/api/locations", SpectatorLocation,
     {"name": "Площадка", "latitude": 53.05, "longitude": 158.65}),
])
async def test_faq_and_locations_order_and_public_fields(client, session, path, model, fields):
    last = model(id=40, **fields, sort_order=8, is_published=True)
    first = model(id=20, **fields, sort_order=2, is_published=True)
    tied = model(id=10, **fields, sort_order=2, is_published=True)
    hidden = model(id=50, **fields, sort_order=0)
    session.add_all([last, first, tied, hidden])
    await session.commit()

    response = await client.get(path)
    assert response.status_code == 200
    assert response.json()["error"] is None
    rows = response.json()["data"]
    assert [row["id"] for row in rows] == [tied.id, first.id, last.id]
    for row in rows:
        assert "is_published" not in row
        assert "created_at" not in row
        assert "updated_at" not in row
        for key, value in fields.items():
            assert row[key] == value
    if path == "/api/locations":
        for row in rows:
            assert row["description"] is None
            assert row["address"] is None
            assert row["how_to_get_there"] is None


async def test_openapi_documents_content_responses(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    document = response.json()
    schemas = document["components"]["schemas"]
    for path, schema in [
        ("/api/program", "ProgramEventOut"),
        ("/api/faq", "FaqItemOut"),
        ("/api/locations", "SpectatorLocationOut"),
    ]:
        operation = document["paths"][path]["get"]
        assert operation["tags"] == ["Контент"]
        response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        envelope = schemas[response_schema["$ref"].rsplit("/", 1)[1]]
        array_schema = next(
            item for item in envelope["properties"]["data"]["anyOf"] if item.get("type") == "array"
        )
        assert array_schema["items"]["$ref"] == f"#/components/schemas/{schema}"
        assert "is_published" not in schemas[schema]["properties"]
