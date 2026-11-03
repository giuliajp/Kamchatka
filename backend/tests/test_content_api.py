"""Публичный контент: публикация, порядок, локации, формат ответов и Swagger."""

from datetime import datetime, timedelta, timezone

import pytest
from app.models import FaqItem, OrganizerContact, ProgramEvent, Race, SpectatorLocation


@pytest.fixture(autouse=True)
async def content_season(session):
    race = Race(id=1, name="Авача 2027", year=2027, is_current=True)
    session.add(race)
    await session.commit()
    return race


START = datetime(2027, 2, 6, 12, tzinfo=timezone(timedelta(hours=12)))


@pytest.mark.parametrize(
    "path,model,fields",
    [
        ("/api/program", ProgramEvent, {"title": "Открытие", "start_at": START}),
        ("/api/faq", FaqItem, {"question": "Что взять?", "answer": "Тёплую одежду."}),
        (
            "/api/locations",
            SpectatorLocation,
            {"name": "Стартовая площадка", "latitude": 53.05, "longitude": 158.65},
        ),
    ],
)
async def test_empty_sections_and_publication_changes(
    client, session, path, model, fields
):
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == {"data": [], "error": None}

    if model is not FaqItem:
        fields = {
            **fields,
            "race_id": 1,
            ("event_type" if model is ProgramEvent else "location_type"): "festival",
        }
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
        race_id=1,
        location_type="festival",
        name="Стартовая площадка",
        latitude=53.05,
        longitude=158.65,
        description="Место для зрителей",
        address="Камчатка",
        how_to_get_there="На автобусе",
        is_published=True,
    )
    late = ProgramEvent(
        race_id=1,
        event_type="festival",
        id=50,
        title="На следующий день",
        start_at=START + timedelta(days=1),
        location=location,
        is_published=True,
    )
    high_order = ProgramEvent(
        race_id=1,
        event_type="festival",
        id=30,
        title="Порядок 7",
        start_at=START + timedelta(hours=1),
        sort_order=7,
        is_published=True,
    )
    low_order = ProgramEvent(
        race_id=1,
        event_type="festival",
        id=20,
        title="Порядок 1",
        start_at=START + timedelta(hours=1),
        sort_order=1,
        is_published=True,
    )
    tied = ProgramEvent(
        race_id=1,
        event_type="festival",
        id=10,
        title="Тот же порядок, меньший ID",
        start_at=START + timedelta(hours=1),
        sort_order=1,
        is_published=True,
    )
    early = ProgramEvent(
        race_id=1,
        event_type="festival",
        id=40,
        title="Открытие",
        description="Начало фестиваля",
        start_at=START,
        end_at=START + timedelta(minutes=30),
        sort_order=99,
        location=location,
        is_published=True,
    )
    hidden = ProgramEvent(
        race_id=1,
        event_type="festival",
        id=60,
        title="Черновик",
        start_at=START - timedelta(days=1),
    )
    # При одинаковом времени и порядке меньший ID должен оказаться первым,
    # даже если запись была добавлена позже.
    session.add_all([late, high_order, low_order, tied, early, hidden])
    await session.commit()

    response = await client.get("/api/program")
    assert response.status_code == 200
    assert response.json()["error"] is None
    rows = response.json()["data"]
    assert [row["id"] for row in rows] == [
        early.id,
        tied.id,
        low_order.id,
        high_order.id,
        late.id,
    ]
    assert rows[0]["description"] == "Начало фестиваля"
    assert set(rows[0]) == {
        "id",
        "title",
        "description",
        "start_at",
        "end_at",
        "location",
        "sort_order",
        "race_id",
        "stage_id",
        "event_type",
        "image_urls",
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
        "race_id": 1,
        "stage_id": None,
        "location_type": "festival",
        "id": location.id,
        "name": "Стартовая площадка",
        "description": "Место для зрителей",
        "latitude": 53.05,
        "longitude": 158.65,
        "address": "Камчатка",
        "how_to_get_there": "На автобусе",
        "image_urls": [],
        "sort_order": 0,
    }


async def test_program_location_follows_publication_and_deletion(client, session):
    location = SpectatorLocation(
        race_id=1,
        location_type="festival",
        name="Черновик площадки",
        latitude=53.05,
        longitude=158.65,
    )
    event = ProgramEvent(
        race_id=1,
        event_type="festival",
        title="Опубликованное событие",
        start_at=START,
        location=location,
        is_published=True,
    )
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


@pytest.mark.parametrize(
    "path,model,fields",
    [
        ("/api/faq", FaqItem, {"question": "Что взять?", "answer": "Тёплую одежду."}),
        (
            "/api/locations",
            SpectatorLocation,
            {"name": "Площадка", "latitude": 53.05, "longitude": 158.65},
        ),
    ],
)
async def test_faq_and_locations_order_and_public_fields(
    client, session, path, model, fields
):
    if model is SpectatorLocation:
        fields = {**fields, "race_id": 1, "location_type": "festival"}
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
        ("/api/contacts", "OrganizerContactOut"),
        ("/api/locations", "SpectatorLocationOut"),
    ]:
        operation = document["paths"][path]["get"]
        assert operation["tags"] == ["Контент"]
        response_schema = operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ]
        envelope = schemas[response_schema["$ref"].rsplit("/", 1)[1]]
        array_schema = next(
            item
            for item in envelope["properties"]["data"]["anyOf"]
            if item.get("type") == "array"
        )
        assert array_schema["items"]["$ref"] == f"#/components/schemas/{schema}"
        assert "is_published" not in schemas[schema]["properties"]


@pytest.mark.parametrize(
    "path,type_field,types",
    [
        ("program", "event_type", ["stage_start", "stage_finish", "festival"]),
        ("locations", "location_type", ["start", "finish", "festival", "viewpoint"]),
    ],
)
async def test_season_archive_and_type_filters(
    client, session, path, type_field, types
):
    archive = Race(id=2, name="Архив 2026", year=2026)
    session.add(archive)
    await session.commit()
    model = ProgramEvent if path == "program" else SpectatorLocation
    fields = (
        {"title": "Событие", "start_at": START}
        if path == "program"
        else {"name": "Место", "latitude": 53, "longitude": 158}
    )
    for race_id in [1, 2]:
        for value in types:
            session.add(
                model(
                    **fields, **{type_field: value}, race_id=race_id, is_published=True
                )
            )
    await session.commit()
    default = (await client.get(f"/api/{path}")).json()["data"]
    assert len(default) == len(types)
    assert {row["race_id"] for row in default} == {1}
    for value in types:
        response = await client.get(
            f"/api/{path}", params={"race_id": 2, "type": value}
        )
        assert response.status_code == 200
        rows = response.json()["data"]
        assert len(rows) == 1
        assert rows[0]["race_id"] == 2
        assert rows[0][type_field] == value
    for params in [{"type": "bad"}, {"race_id": 0}, {"race_id": "abc"}]:
        assert (await client.get(f"/api/{path}", params=params)).status_code == 422
    assert (await client.get(f"/api/{path}?race_id=999")).status_code == 404


@pytest.mark.parametrize("path", ["program", "locations"])
async def test_no_current_falls_back_to_latest_and_no_races_returns_empty(
    client,
    session,
    path,
    content_season,
):
    from sqlalchemy import delete

    content_season.is_current = False
    session.add(Race(id=2, name="Новый сезон", year=2028))
    await session.commit()
    if path == "program":
        item = ProgramEvent(
            race_id=2,
            event_type="festival",
            title="Новый сезон",
            start_at=START,
            is_published=True,
        )
    else:
        item = SpectatorLocation(
            race_id=2,
            location_type="festival",
            name="Новый сезон",
            latitude=53,
            longitude=158,
            is_published=True,
        )
    session.add(item)
    await session.commit()
    rows = (await client.get(f"/api/{path}")).json()["data"]
    assert [row["id"] for row in rows] == [item.id]
    await session.execute(delete(Race))
    await session.commit()
    assert (await client.get(f"/api/{path}")).json() == {"data": [], "error": None}


async def test_program_does_not_expose_location_from_another_season(client, session):
    session.add(Race(id=2, name="Архив", year=2026))
    await session.flush()
    location = SpectatorLocation(
        race_id=2,
        location_type="festival",
        name="Архивная",
        latitude=53,
        longitude=158,
        is_published=True,
    )
    session.add(location)
    await session.flush()
    session.add(
        ProgramEvent(
            race_id=1,
            event_type="festival",
            title="Событие",
            start_at=START,
            location_id=location.id,
            is_published=True,
        )
    )
    await session.commit()
    assert (await client.get("/api/program")).json()["data"][0]["location"] is None


async def test_contacts_publication_order_and_nullable_fields(client, session):
    assert (await client.get("/api/contacts")).json()["data"] == []
    session.add_all(
        [
            OrganizerContact(id=30, title="Последний", sort_order=3, is_published=True),
            OrganizerContact(id=20, title="Второй", sort_order=1, is_published=True),
            OrganizerContact(
                id=10,
                title="Первый",
                name="Иван",
                phone="+7 000 000-00-00",
                email="example@example.org",
                url="https://example.org",
                sort_order=1,
                is_published=True,
            ),
            OrganizerContact(id=40, title="Черновик"),
        ]
    )
    await session.commit()
    response = await client.get("/api/contacts")
    assert response.status_code == 200
    rows = response.json()["data"]
    assert [row["id"] for row in rows] == [10, 20, 30]
    assert rows[0] == {
        "id": 10,
        "title": "Первый",
        "name": "Иван",
        "phone": "+7 000 000-00-00",
        "email": "example@example.org",
        "url": "https://example.org",
        "sort_order": 1,
    }
    assert rows[1]["phone"] is None
    assert all("is_published" not in row and "created_at" not in row for row in rows)
    first = await session.get(OrganizerContact, 10)
    first.is_published = False
    await session.commit()
    assert [
        row["id"] for row in (await client.get("/api/contacts")).json()["data"]
    ] == [20, 30]


async def test_openapi_documents_season_and_type_filters(client):
    doc = (await client.get("/openapi.json")).json()
    for path in ["program", "locations"]:
        parameters = {
            p["name"]: p for p in doc["paths"][f"/api/{path}"]["get"]["parameters"]
        }
        assert {"race_id", "type"} <= parameters.keys()
        assert parameters["race_id"]["required"] is False
        assert parameters["type"]["required"] is False
