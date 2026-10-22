"""
Ручная работа с Iridium360 из терминала (из корня проекта, с включённым окружением).

Проверить ключ и посмотреть устройства (в базу ничего не пишет):
    python backend/scripts/poll_iridium.py --check

Выполнить один цикл опроса и сохранить точки в базу:
    python backend/scripts/poll_iridium.py --once

Ключ берётся из backend/.env (IRIDIUM360_API_KEY) и на экран не выводится.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path


async def check() -> int:
    from app.services.iridium360.client import Iridium360Client, Iridium360Error

    async with Iridium360Client() as client:
        try:
            devices = await client.fetch_devices()
        except Iridium360Error as error:
            print(f"Ошибка: {error}", file=sys.stderr)
            return 1
    print(f"Устройств: {len(devices)}")
    for d in devices:
        last = d.last_position
        where = (f"{last.at:%Y-%m-%d %H:%M} UTC  {last.lat:.5f}, {last.lon:.5f}  "
                 f"батарея {last.battery}") if last else "точек нет"
        print(f"  IMEI {d.imei}  №{d.number}  {d.name or ''}  —  {where}")
    return 0


async def once() -> int:
    from app.db import SessionLocal, engine
    from app.services.iridium360.client import Iridium360Client
    from app.services.iridium360.ingest import poll_once

    try:
        async with Iridium360Client() as client:
            report = await poll_once(SessionLocal, client)
    finally:
        await engine.dispose()
    print(report.summary())
    if report.new_devices:
        print("Новые устройства (выключены, привяжите в админке): " + ", ".join(report.new_devices))
    return 1 if report.errors else 0


def main(argv: list[str] | None = None) -> int:
    backend_dir = str(Path(__file__).resolve().parents[1])
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    parser = argparse.ArgumentParser(description="Iridium360: проверка ключа и ручной опрос.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Показать устройства, ничего не сохранять")
    mode.add_argument("--once", action="store_true", help="Один цикл опроса с сохранением в базу")
    args = parser.parse_args(argv)
    return asyncio.run(check() if args.check else once())


if __name__ == "__main__":
    raise SystemExit(main())
