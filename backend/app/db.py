"""
Подключение к базе данных (асинхронное).

- Base           — базовый класс для всех моделей (app/models/)
- engine         — подключение к базе
- SessionLocal   — «фабрика» сессий
- get_session()  — зависимость FastAPI: даёт эндпоинту сессию и закрывает её после ответа

ВАЖНО про async SQLAlchemy: связанные данные нельзя подгружать «лениво»
(просто обратившись к participant.entries). Их загружают явно в запросе:

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    stmt = select(Entry).options(selectinload(Entry.participant))

Если забыть — будет понятная ошибка (у всех связей стоит lazy="raise_on_sql").
"""

from collections.abc import AsyncIterator

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

# Единые имена для индексов и ограничений — чтобы миграции Alembic были стабильными.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


settings = get_settings()

engine = create_async_engine(settings.database_url)

# expire_on_commit=False — после commit() объекты остаются доступными
# без повторного запроса в базу (в async это важно).
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
