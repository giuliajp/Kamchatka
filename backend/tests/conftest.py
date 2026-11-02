"""
Общие заготовки для тестов (pytest находит этот файл сам).

session — сессия базы данных: временная схема PostgreSQL для каждого теста
client  — «браузер» для запросов к API; эндпоинты работают с той же временной базой
"""

from uuid import uuid4

import pytest
from sqlalchemy import text
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models  # noqa: F401  — регистрируем все таблицы
from app.config import get_settings
from app.db import Base, get_session
from app.main import app as fastapi_app


@pytest.fixture
async def empty_engine():
    schema = "test_" + uuid4().hex
    url = get_settings().database_url
    admin_engine = create_async_engine(url)
    engine = create_async_engine(
        url,
        connect_args={"server_settings": {"search_path": schema}},
    )
    try:
        async with admin_engine.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        yield engine
    finally:
        await engine.dispose()
        try:
            async with admin_engine.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        finally:
            await admin_engine.dispose()


@pytest.fixture
async def engine(empty_engine):
    async with empty_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return empty_engine


@pytest.fixture
async def session(engine):
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        yield session


@pytest.fixture
async def client(engine):
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session():
        async with maker() as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_get_session
    try:
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            yield client
    finally:
        fastapi_app.dependency_overrides.clear()
