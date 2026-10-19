"""
Опубликовать протоколы гонки, чтобы они появились в приложении.

Временная замена кнопки «Опубликовать» в админке (задача 3.3).
Импорт создаёт протоколы черновиками — без публикации API их не показывает.

Из корня проекта, с включённым окружением:
    python backend/scripts/publish_protocols.py --year 2026

Повторный запуск ничего не меняет: уже опубликованные протоколы пропускаются.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path


async def publish(year: int) -> int:
    backend_dir = str(Path(__file__).resolve().parents[1])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from sqlalchemy import select

    from app.db import SessionLocal, engine
    from app.models import Protocol, Race, Stage

    try:
        async with SessionLocal.begin() as session:
            race = (await session.execute(select(Race).where(Race.year == year))).scalar_one_or_none()
            if race is None:
                raise LookupError(f"Гонка {year} года не найдена. Сначала выполните импорт.")
            protocols = (await session.execute(
                select(Protocol).join(Stage, Stage.id == Protocol.stage_id)
                .where(Stage.race_id == race.id, Protocol.published_at.is_(None))
            )).scalars().all()
            now = datetime.now(UTC)
            for protocol in protocols:
                protocol.published_at = now
            return len(protocols)
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Опубликовать протоколы гонки за год.")
    parser.add_argument("--year", type=int, required=True, help="Год гонки, например 2026")
    args = parser.parse_args(argv)
    try:
        count = asyncio.run(publish(args.year))
    except LookupError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 1
    print(f"Опубликовано протоколов: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
