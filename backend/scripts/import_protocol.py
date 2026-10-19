"""Импорт итогового JSON-протокола в PostgreSQL из командной строки."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from asyncpg import PostgresError
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

if TYPE_CHECKING:
    from app.services.protocol_import import ProtocolImportResult

REPORT_LABELS = (
    ("races", "Гонки"),
    ("stages", "Этапы"),
    ("disciplines", "Дисциплины"),
    ("participants", "Спортсмены"),
    ("race_participants", "Участия в гонке"),
    ("protocols", "Протоколы"),
    ("stage_results", "Результаты этапов"),
    ("penalties", "Штрафы"),
)


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Импорт итогового JSON-протокола архивной гонки в PostgreSQL.",
    )
    parser.add_argument(
        "--json", type=Path, required=True, help="Путь к JSON от PDF-парсера"
    )
    return parser.parse_args(argv)


def read_document(path: Path) -> dict:
    document = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(document, dict):
        raise ValueError("Ожидается JSON-объект с данными протокола")
    return document


async def run_import(document: dict) -> ProtocolImportResult:
    # Позволяет запускать файл напрямую из корня проекта или другого каталога.
    backend_dir = str(Path(__file__).resolve().parents[1])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    # Настройки БД нужны только для импорта, но не для --help или чтения файла.
    from app.db import SessionLocal, engine
    from app.services.protocol_import import import_protocol

    try:
        async with SessionLocal.begin() as session:
            result = await import_protocol(session, document)
        return result
    finally:
        await engine.dispose()


def print_report(result: ProtocolImportResult) -> None:
    print(f"Импорт завершён. ID гонки: {result.race_id}")
    print("Создано записей:")
    for table, label in REPORT_LABELS:
        print(f"  {label}: {result.created.get(table, 0)}")
    if not result.created:
        print("Все записи уже существуют и совпадают с JSON.")
    print(f"Пропущено пустых результатов после DNF/DNS: {result.skipped_stage_results}")
    for warning in result.warnings:
        print(f"Предупреждение: {warning}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    args = parse_arguments(argv)
    try:
        document = read_document(args.json)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Ошибка чтения JSON: {exc}", file=sys.stderr)
        return 1

    try:
        result = asyncio.run(run_import(document))
    except ValidationError as exc:
        print("Ошибка проверки данных или настроек:", file=sys.stderr)
        for error in exc.errors(
            include_input=False, include_url=False, include_context=False
        ):
            location = ".".join(str(part) for part in error["loc"]) or "document"
            print(f"  {location}: {error['msg']}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"Ошибка импорта: {exc}", file=sys.stderr)
        return 1
    except (SQLAlchemyError, PostgresError, OSError):
        print(
            "Ошибка БД: не удалось завершить импорт. "
            "Проверьте подключение и применённые миграции.",
            file=sys.stderr,
        )
        return 1

    print_report(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
