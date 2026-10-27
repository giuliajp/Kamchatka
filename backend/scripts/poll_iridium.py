"""
Ручная работа с Iridium360 из терминала (из корня проекта, с включённым окружением).

Проверить ключ и посмотреть устройства (в базу ничего не пишет):
    python backend/scripts/poll_iridium.py --check

Выполнить один цикл опроса и сохранить точки в базу:
    python backend/scripts/poll_iridium.py --once

Посмотреть ответ Iridium как есть (первое устройство) — для сверки формата:
    python backend/scripts/poll_iridium.py --raw

Трек одного устройства за период (номер — из колонки «№» в --check):
    python backend/scripts/poll_iridium.py --track 300534062392060 --from 2026-02-06T00:00:00 --to 2026-02-16T00:00:00

Ключ берётся из backend/.env (IRIDIUM360_API_KEY) и на экран не выводится.
"""

from __future__ import annotations

import argparse
import asyncio
import json
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


async def raw() -> int:
    from app.services.iridium360.client import Iridium360Client, Iridium360Error

    async with Iridium360Client() as client:
        try:
            payload = await client.fetch_raw()
        except Iridium360Error as error:
            print(f"Ошибка: {error}", file=sys.stderr)
            return 1
    first = payload[:1] if isinstance(payload, list) else payload
    print(json.dumps(first, ensure_ascii=False, indent=2))
    return 0


async def track(number: str, date_from: str | None, date_to: str | None) -> int:
    from app.services.iridium360.client import Iridium360Client, Iridium360Error, parse_devices

    params = {"number": number, "include_track": "true"}
    if date_from:
        params["date_from"] = date_from
    if date_to:
        params["date_to"] = date_to
    async with Iridium360Client() as client:
        try:
            payload = await client.fetch_raw(params)
        except Iridium360Error as error:
            print(f"Ошибка: {error}", file=sys.stderr)
            return 1
    devices = parse_devices(payload)
    print(f"Устройств в ответе: {len(devices)}")
    for d in devices[:3]:
        print(f"  IMEI {d.imei}  №{d.number}  точек в треке: {len(d.track)}")
        if d.track:
            print(f"    первая: {d.track[0].at:%Y-%m-%d %H:%M} UTC, последняя: {d.track[-1].at:%Y-%m-%d %H:%M} UTC")
    # Две первые точки как есть — чтобы увидеть точный формат даты и единицы.
    item = payload[0] if isinstance(payload, list) and payload else payload
    points = ((item or {}).get("Track") or {}).get("Points") or [] if isinstance(item, dict) else []
    print("Первые точки как есть:")
    print(json.dumps(points[:2], ensure_ascii=False, indent=2))
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
    mode.add_argument("--raw", action="store_true", help="Ответ Iridium как есть (первое устройство)")
    mode.add_argument("--track", metavar="НОМЕР", help="Трек устройства по номеру из колонки «№»")
    parser.add_argument("--from", dest="date_from", help="Начало периода для --track, например 2026-02-06T00:00:00")
    parser.add_argument("--to", dest="date_to", help="Конец периода для --track, например 2026-02-16T00:00:00")
    args = parser.parse_args(argv)
    if args.check:
        return asyncio.run(check())
    if args.raw:
        return asyncio.run(raw())
    if args.track:
        return asyncio.run(track(args.track, args.date_from, args.date_to))
    return asyncio.run(once())


if __name__ == "__main__":
    raise SystemExit(main())
