"""Фоновые задачи выполняет только один процесс; /docs скрыт в production."""

import asyncio

from app.config import get_settings
from app.main import create_app
from app.services.leader import run_as_leader


async def test_only_one_leader(engine):
    started = []
    release = asyncio.Event()

    async def job(stop):
        started.append(1)
        await release.wait()

    stop = asyncio.Event()
    first = asyncio.create_task(run_as_leader(engine, 99_000_001, stop, job, retry=0.05))
    second = asyncio.create_task(run_as_leader(engine, 99_000_001, stop, job, retry=0.05))
    await asyncio.sleep(0.4)
    assert started == [1]                      # второй ждёт замок
    release.set()
    await asyncio.sleep(0.4)
    assert started == [1, 1]                   # первый закончил — замок взял второй
    stop.set()
    await asyncio.gather(first, second)


def test_docs_hidden_in_production(monkeypatch):
    settings = get_settings()
    assert create_app().docs_url == "/docs"
    monkeypatch.setattr(settings, "environment", "production")
    app = create_app()
    assert app.docs_url is None and app.openapi_url is None
