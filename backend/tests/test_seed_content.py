"""Примеры контента: повторный запуск, сохранение правок, транзакция и CLI."""

import asyncio
import os
import subprocess
import sys
from pathlib import Path

import app.db
import pytest
from asyncpg import PostgresError
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import FaqItem, ProgramEvent, SpectatorLocation
from scripts import seed_content as cli

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "seed_content.py"
MODELS = (SpectatorLocation, ProgramEvent, FaqItem)


@pytest.fixture
def cli_database(engine, monkeypatch):
    monkeypatch.setattr(app.db, "engine", engine)
    monkeypatch.setattr(
        app.db, "SessionLocal", async_sessionmaker(engine, expire_on_commit=False)
    )


async def content_snapshot(session):
    """Все поля записей, включая ID и даты, для проверки отсутствия изменений."""
    snapshot = {}
    for model in MODELS:
        result = await session.execute(select(model.__table__).order_by(model.id))
        snapshot[model.__tablename__] = [dict(row) for row in result.mappings()]
    return snapshot


@pytest.mark.parametrize("help_requested", [True, False])
def test_script_from_outside_repository_with_invalid_settings(tmp_path, help_requested):
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment["POSTGRES_PORT"] = "not-a-port"
    environment["POSTGRES_PASSWORD"] = "do-not-print-this-password"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), *(["--help"] if help_requested else [])],
        cwd=tmp_path, env=environment, capture_output=True, text=True, timeout=20,
    )
    assert result.returncode == (0 if help_requested else 1)
    output = result.stdout + result.stderr
    assert ("--help" if help_requested else "postgres_port:") in output
    assert "Traceback" not in output
    assert "do-not-print-this-password" not in output
    if not help_requested:
        assert result.stdout == ""


@pytest.mark.parametrize("error_class", [SQLAlchemyError, PostgresError, OSError])
def test_database_error_returns_failure_without_secrets(monkeypatch, capsys, error_class):
    async def failing_seed():
        raise error_class("do-not-print-this-password")

    monkeypatch.setattr(cli, "run_seed", failing_seed)
    assert cli.main([]) == 1
    output = capsys.readouterr()
    assert output.out == ""
    assert "Ошибка БД:" in output.err
    assert "Traceback" not in output.err
    assert "do-not-print-this-password" not in output.err


async def test_repeat_preserves_rows_and_populates_api(cli_database, session, client):
    assert await cli.run_seed() == {"locations": 2, "program": 3, "faq": 3}
    before = await content_snapshot(session)
    assert await cli.run_seed() == {"locations": 0, "program": 0, "faq": 0}
    assert await content_snapshot(session) == before

    bodies = {}
    for path, count in [("locations", 2), ("program", 3), ("faq", 3)]:
        response = await client.get(f"/api/{path}")
        assert response.status_code == 200
        assert response.json()["error"] is None
        bodies[path] = response.json()["data"]
        assert len(bodies[path]) == count
    location_ids = {row["id"] for row in bodies["locations"]}
    assert all(row["location"]["id"] in location_ids for row in bodies["program"])
    assert bodies["program"][0]["location"] == bodies["program"][1]["location"]
    assert all("Пример:" in row["title"] for row in bodies["program"])
    assert all("Пример:" in row["name"] for row in bodies["locations"])
    assert all("Пример:" in row["question"] for row in bodies["faq"])


async def test_partial_seed_reuses_existing_records(cli_database, session):
    location = SpectatorLocation(**{
        **cli.LOCATION_SAMPLES[0], "description": "Правка организатора",
    })
    fields = cli.PROGRAM_SAMPLES[0].copy()
    fields.pop("location_name")
    event = ProgramEvent(**fields, location=location)
    faq = FaqItem(**{**cli.FAQ_SAMPLES[0], "answer": "Правка ответа"})
    session.add_all([location, event, faq])
    await session.commit()
    location_id, event_id, faq_id = location.id, event.id, faq.id

    assert await cli.run_seed() == {"locations": 1, "program": 2, "faq": 2}
    session.expunge_all()
    existing_location = await session.get(SpectatorLocation, location_id)
    existing_event = await session.get(ProgramEvent, event_id)
    existing_faq = await session.get(FaqItem, faq_id)
    assert existing_location.description == "Правка организатора"
    assert existing_location.is_published is False
    assert existing_event.is_published is False
    assert existing_faq.answer == "Правка ответа"
    assert existing_faq.is_published is False
    snapshot = await content_snapshot(session)
    assert [len(snapshot[model.__tablename__]) for model in MODELS] == [2, 3, 3]


async def test_existing_edits_and_publication_are_preserved(cli_database, session):
    await cli.run_seed()
    location = await session.scalar(select(SpectatorLocation).order_by(SpectatorLocation.id))
    event = await session.scalar(select(ProgramEvent).order_by(ProgramEvent.id))
    faq = await session.scalar(select(FaqItem).order_by(FaqItem.id))
    location.description = "Изменённое описание"
    location.is_published = False
    event.description = "Новое описание события"
    event.is_published = False
    faq.answer = "Новый ответ"
    faq.is_published = False
    await session.commit()
    before = await content_snapshot(session)

    assert await cli.run_seed() == {"locations": 0, "program": 0, "faq": 0}
    assert await content_snapshot(session) == before


@pytest.mark.parametrize("failure", ["flush", "commit"])
async def test_failed_seed_rolls_back_every_new_record(cli_database, session, failure):
    session.add(FaqItem(question="Вопрос организатора", answer="Исходный ответ"))
    await session.commit()
    before = await content_snapshot(session)
    constraint = (
        "CHECK (sort_order <> 2)" if failure == "flush"
        else "UNIQUE (is_published) DEFERRABLE INITIALLY DEFERRED"
    )
    # Искусственная ошибка только во временной схеме. Отложенное ограничение
    # проверяет откат при ошибке commit, когда все INSERT уже прошли.
    await session.execute(text(
        "ALTER TABLE faq_items ADD CONSTRAINT test_reject_seed " + constraint
    ))
    await session.commit()

    with pytest.raises(IntegrityError):
        await cli.run_seed()
    assert await content_snapshot(session) == before


async def test_concurrent_runs_do_not_duplicate_samples(engine, session):
    factory = async_sessionmaker(engine, expire_on_commit=False)
    start = asyncio.Event()
    ready = 0

    async def seed_once():
        nonlocal ready
        async with factory.begin() as transaction:
            # Оба запуска получают соединения до начала наполнения.
            await transaction.connection()
            ready += 1
            if ready == 2:
                start.set()
            await start.wait()
            return await cli.seed_content(transaction)

    reports = await asyncio.wait_for(asyncio.gather(seed_once(), seed_once()), timeout=10)
    assert sorted(reports, key=lambda report: report["locations"]) == [
        {"locations": 0, "program": 0, "faq": 0},
        {"locations": 2, "program": 3, "faq": 3},
    ]
    for model, expected in zip(MODELS, [2, 3, 3]):
        assert await session.scalar(select(func.count()).select_from(model)) == expected
