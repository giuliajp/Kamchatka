"""Ограничения сезонного контента в реальной PostgreSQL, без миграций."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models import OrganizerContact, ProgramEvent, Race, SpectatorLocation, Stage


@pytest.mark.parametrize("model", [ProgramEvent, SpectatorLocation])
async def test_stage_must_belong_to_content_race(session, model):
    current = Race(name="Текущий сезон", year=2027)
    archive = Race(name="Архив", year=2026)
    session.add_all([current, archive])
    await session.flush()
    stage = Stage(race_id=archive.id, number=1)
    session.add(stage)
    await session.flush()
    fields = ({"title": "Старт", "start_at": datetime(2027, 2, 6, tzinfo=UTC),
               "event_type": "stage_start"} if model is ProgramEvent else
              {"name": "Старт", "latitude": 53, "longitude": 158, "location_type": "start"})
    item = model(**fields, race_id=archive.id, stage_id=stage.id)
    session.add(item)
    await session.commit()
    item.race_id = current.id
    with pytest.raises(IntegrityError, match="stage_race"):
        await session.commit()


@pytest.mark.parametrize("model,column", [
    (ProgramEvent, "event_type"), (SpectatorLocation, "location_type"),
])
async def test_content_requires_race_and_valid_type(session, model, column):
    race = Race(name="Сезон", year=2027)
    session.add(race)
    await session.flush()
    fields = ({"title": "Событие", "start_at": datetime(2027, 2, 6, tzinfo=UTC)}
              if model is ProgramEvent else {"name": "Место", "latitude": 53, "longitude": 158})
    item = model(**fields, **{column: "festival"})
    session.add(item)
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()
    session.add(Race(id=1, name="Сезон", year=2027))
    await session.flush()
    item = model(**fields, **{column: "festival"}, race_id=1)
    session.add(item)
    await session.commit()
    with pytest.raises(IntegrityError):
        await session.execute(text(
            f"UPDATE {model.__tablename__} SET {column} = 'invalid'"
        ))
        await session.commit()


async def test_contacts_are_drafts_and_order_is_non_negative(session):
    contact = OrganizerContact(title="Организатор")
    session.add(contact)
    await session.commit()
    assert contact.is_published is False
    assert contact.sort_order == 0
    assert contact.phone is None
    contact.sort_order = -1
    with pytest.raises(IntegrityError):
        await session.commit()
