"""Заполнить программу, FAQ и зрительские локации примерами для разработки.

Из корня проекта после применения миграций:
    python backend/scripts/seed_content.py

Даты, координаты и тексты условные; это не официальная программа фестиваля.
Примеры публикуются и сразу видны через API. Существующие записи не меняются.
Повторный запуск узнаёт локации по сезону и названию, события по сезону, названию
и времени начала, FAQ по вопросу, контакты по заголовку. Если изменить эти поля, запись станет другим примером.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from asyncpg import PostgresError
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

LOCATION_SAMPLES = (
    {
        "name": "Пример: стартовая площадка",
        "location_type": "start",
        "description": "Условная площадка для проверки карты и программы.",
        "latitude": 53.05,
        "longitude": 158.65,
        "address": "Пример адреса стартовой площадки",
        "how_to_get_there": "Здесь организаторы разместят описание проезда.",
        "sort_order": 0,
    },
    {
        "name": "Пример: зрительская зона",
        "location_type": "viewpoint",
        "description": "Условная зрительская зона для проверки интерфейса.",
        "latitude": 53.06,
        "longitude": 158.66,
        "sort_order": 1,
    },
)

PROGRAM_SAMPLES = (
    {
        "title": "Пример: открытие фестиваля",
        "event_type": "festival",
        "description": "Демонстрационное событие; дата и время условные.",
        "start_at": datetime(2027, 2, 6, 0, 0, tzinfo=UTC),
        "end_at": datetime(2027, 2, 6, 0, 30, tzinfo=UTC),
        "location_name": "Пример: стартовая площадка",
        "sort_order": 0,
    },
    {
        "title": "Пример: старт гонки",
        "event_type": "stage_start",
        "description": "Демонстрационный старт, не официальное расписание.",
        "start_at": datetime(2027, 2, 6, 1, 0, tzinfo=UTC),
        "location_name": "Пример: стартовая площадка",
        "sort_order": 1,
    },
    {
        "title": "Пример: финиш и встреча со зрителями",
        "event_type": "stage_finish",
        "description": "Демонстрационный финиш; дата и время условные.",
        "start_at": datetime(2027, 2, 7, 2, 0, tzinfo=UTC),
        "end_at": datetime(2027, 2, 7, 3, 0, tzinfo=UTC),
        "location_name": "Пример: зрительская зона",
        "sort_order": 2,
    },
)

CONTACT_SAMPLES = (
    {
        "title": "Пример: организационный комитет",
        "name": "Пример контакта",
        "email": "organizer@example.org",
        "url": "https://example.org",
        "sort_order": 0,
    },
    {"title": "Пример: вопросы зрителей", "sort_order": 1},
)

FAQ_SAMPLES = (
    {
        "question": "Пример: где посмотреть программу?",
        "answer": "Здесь организаторы разместят информацию о программе фестиваля.",
        "sort_order": 0,
    },
    {
        "question": "Пример: как добраться до зрительских площадок?",
        "answer": "Здесь будет информация о проезде к зрительским локациям.",
        "sort_order": 1,
    },
    {
        "question": "Пример: что взять с собой?",
        "answer": "Здесь будет список вещей и рекомендации организаторов.",
        "sort_order": 2,
    },
)


async def seed_content(
    session: AsyncSession, race_id: int | None = None
) -> dict[str, int]:
    """Добавить недостающие примеры. Транзакцией управляет вызывающий код."""
    from app.models import (
        FaqItem,
        OrganizerContact,
        ProgramEvent,
        Race,
        SpectatorLocation,
        Stage,
    )
    from app.services.content import content_race_id

    # Сериализуем одновременные запуски скрипта; блокировка снимается с транзакцией.
    await session.execute(text("SELECT pg_advisory_xact_lock(270004)"))
    selected_race = await content_race_id(session, race_id)
    if selected_race is None:
        raise ValueError(
            "Гонка не найдена. Сначала создайте сезон или укажите --race-id."
        )
    race = await session.get(Race, selected_race)
    stages = (
        await session.scalars(
            select(Stage).where(Stage.race_id == selected_race).order_by(Stage.number)
        )
    ).all()
    created = {"locations": 0, "program": 0, "faq": 0, "contacts": 0}
    locations = {}
    for sample in LOCATION_SAMPLES:
        location = (
            await session.execute(
                select(SpectatorLocation).where(
                    SpectatorLocation.name == sample["name"],
                    SpectatorLocation.race_id == selected_race,
                )
            )
        ).scalar_one_or_none()
        if location is None:
            location = SpectatorLocation(
                **sample,
                race_id=selected_race,
                stage_id=stages[0].id
                if sample["location_type"] == "start" and stages
                else None,
                is_published=True,
            )
            session.add(location)
            created["locations"] += 1
        locations[sample["name"]] = location
    await session.flush()

    for sample in PROGRAM_SAMPLES:
        sample = sample.copy()
        for field in ("start_at", "end_at"):
            if field in sample:
                sample[field] = sample[field].replace(year=race.year)
        event_id = (
            await session.execute(
                select(ProgramEvent.id).where(
                    ProgramEvent.title == sample["title"],
                    ProgramEvent.race_id == selected_race,
                    ProgramEvent.start_at == sample["start_at"],
                )
            )
        ).scalar_one_or_none()
        if event_id is None:
            fields = sample.copy()
            location_name = fields.pop("location_name")
            session.add(
                ProgramEvent(
                    **fields,
                    race_id=selected_race,
                    stage_id=(
                        stages[0].id
                        if fields["event_type"] == "stage_start" and stages
                        else stages[-1].id
                        if fields["event_type"] == "stage_finish" and stages
                        else None
                    ),
                    location_id=locations[location_name].id,
                    is_published=True,
                )
            )
            created["program"] += 1

    for sample in FAQ_SAMPLES:
        item_id = (
            await session.execute(
                select(FaqItem.id).where(FaqItem.question == sample["question"])
            )
        ).scalar_one_or_none()
        if item_id is None:
            session.add(FaqItem(**sample, is_published=True))
            created["faq"] += 1
    for sample in CONTACT_SAMPLES:
        existing = await session.scalar(
            select(OrganizerContact.id).where(OrganizerContact.title == sample["title"])
        )
        if existing is None:
            session.add(OrganizerContact(**sample, is_published=True))
            created["contacts"] += 1
    await session.flush()
    return created


async def run_seed(race_id: int | None = None) -> dict[str, int]:
    backend_dir = str(Path(__file__).resolve().parents[1])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.db import SessionLocal, engine

    try:
        async with SessionLocal.begin() as session:
            created = await seed_content(session, race_id)
        return created
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Добавить опубликованные примеры контента."
    )
    parser.add_argument(
        "--race-id", type=int, help="Сезон для примеров (по умолчанию текущий)"
    )
    args = parser.parse_args(argv)
    if args.race_id is not None and args.race_id <= 0:
        parser.error("--race-id должен быть положительным")
    try:
        created = asyncio.run(
            run_seed(args.race_id) if args.race_id is not None else run_seed()
        )
    except ValidationError as error:
        print("Ошибка настроек:", file=sys.stderr)
        for detail in error.errors(
            include_input=False, include_url=False, include_context=False
        ):
            field = ".".join(str(part) for part in detail["loc"])
            print(f"  {field}: {detail['msg']}", file=sys.stderr)
        return 1
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (SQLAlchemyError, PostgresError, OSError):
        print(
            "Ошибка БД: не удалось добавить примеры контента. "
            "Проверьте подключение и применённые миграции.",
            file=sys.stderr,
        )
        return 1

    print("Создано записей:")
    print(f"  Локации: {created['locations']}")
    print(f"  События программы: {created['program']}")
    print(f"  Контакты: {created['contacts']}")
    print(f"  FAQ: {created['faq']}")
    if not any(created.values()):
        print("Все примеры уже существуют.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
