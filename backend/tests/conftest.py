"""
Общие заготовки для тестов (pytest находит этот файл сам).

session — сессия базы данных: пустая временная база в памяти для каждого теста
client  — «браузер» для запросов к API; эндпоинты работают с той же временной базой
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  — регистрируем все таблицы
from app.db import Base, get_session
from app.main import app as fastapi_app


@pytest.fixture
async def engine():
    # StaticPool — одна общая база в памяти на весь тест
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


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
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
        yield client
    fastapi_app.dependency_overrides.clear()
