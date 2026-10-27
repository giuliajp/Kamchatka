"""
Интеграция с платформой мониторинга Iridium360 (https://www.iridium360.ru).
Документация API: https://api.iridium360.ru/ (разбор — docs/iridium360.md).

Ключевые правила из брифа (раздел «Данные трекинга») — не нарушать при реализации:

1. Только backend обращается к API Iridium360. Frontend всегда получает данные от НАШЕГО backend,
   никогда напрямую от Iridium360 — это нужно для лимитов платформы, истории треков и независимости
   от смены поставщика оборудования.

2. Соответствие "устройство (IMEI) → участник → этап" хранится в нашей БД
   (app/models/tracking.py: TrackerDevice и TrackerAssignment), платформа мониторинга такой связи
   не содержит. Точки сохраняем в TrackerPosition — повторно пришедшая точка отклоняется
   ограничениями уникальности (устройство + id точки Iridium; устройство + время точки).
   В точку записываем race_participant_id на момент получения.

3. Интервал передачи данных настраивается на устройстве (15 сек – 24 часа), тарифицируется за
   сообщение. Базовый интервал на гонке — 20 минут, но код не должен быть жёстко завязан на это
   число. Интервал трекера хранится в БД: Race.tracking_interval_minutes, может
   переопределяться в Stage (свойство Stage.effective_interval_minutes).
   Settings.tracker_poll_interval_seconds — это другое: как часто НАШ бэкенд опрашивает Iridium360.

4. Положение участника — это ВСЕГДА последняя подтверждённая точка с обязательной меткой времени.
   Не рисовать как непрерывное движение. Допускается интерполяция по треку между двумя точками,
   но расчётное положение должно визуально отличаться и быть подписано как расчётное.

5. Скорость считается как средняя на отрезке между двумя переданными точками, а не мгновенная.

6. SOS-сигнал (тревожная кнопка) — обрабатывать и сохранять, но НИКОГДА не отдавать в публичный
   API для frontend. Он должен быть виден только в API для admin-panel (мониторинг оборудования).
   Хранится в отдельной таблице TrackerAlert, а не в позициях — чтобы не утёк на публичную карту.

7. Официальные результаты — НЕ из трекера, а только из судейских протоколов (Protocol, StageResult).
   При расхождении GPS и судей — приоритет у судей.

Про асинхронность: используем httpx.AsyncClient, НЕ requests — requests блокирует цикл событий,
и пока он ждёт ответа Iridium, сервер не обслуживает никого. Опрос идёт фоновой задачей
по расписанию (задача 2.6, app/services/iridium360/poller.py), а не внутри запросов пользователей.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class Iridium360Error(Exception):
    """Iridium360 недоступен или ответил ошибкой. Опрос просто попробует в следующий раз."""


@dataclass(frozen=True)
class IridiumPoint:
    """Одна точка устройства — как в ответе Iridium360, уже в наших единицах."""
    id: str | None
    at: datetime              # UTC
    lat: float
    lon: float
    course: float | None = None
    speed: float | None = None
    altitude: float | None = None
    battery: float | None = None


@dataclass(frozen=True)
class IridiumDevice:
    name: str | None
    number: str | None        # «номер устройства» — нужен для запроса трека
    imei: str
    last_position: IridiumPoint | None
    track: tuple[IridiumPoint, ...] = ()


# ── Разбор ответа ──────────────────────────────────────────────────────
# Формат известен только по документации, живого ответа ещё не видели.
# Поэтому разбор «терпеливый»: регистр ключей не важен, дата — в любом из частых форматов.

def _get(data: dict[str, Any], key: str) -> Any:
    wanted = key.lower()
    for k, v in data.items():
        if k.lower() == wanted:
            return v
    return None


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


_MS_DATE = re.compile(r"/Date\((-?\d+)([+-]\d{4})?\)/")   # формат ASP.NET: /Date(1700000000000)/


def parse_datetime(value: Any) -> datetime | None:
    """Время UTC из ответа Iridium. Без зоны считаем UTC (так сказано в документации)."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 10**11 else value
        return datetime.fromtimestamp(seconds, UTC)
    text = str(value).strip()
    match = _MS_DATE.fullmatch(text)
    if match:
        return datetime.fromtimestamp(int(match.group(1)) / 1000, UTC)
    for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=UTC)
        except ValueError:
            pass
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def parse_point(data: Any) -> IridiumPoint | None:
    """None — если точки нет или в ней нет времени/координат (такую не сохраняем)."""
    if not isinstance(data, dict):
        return None
    at = parse_datetime(_get(data, "Date"))
    lat, lon = _number(_get(data, "Lat")), _number(_get(data, "Lon"))
    if at is None or lat is None or lon is None:
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
        return None   # мусорная точка (часто 0,0 — «нет фикса»)
    point_id = _get(data, "Id")
    return IridiumPoint(
        id=str(point_id) if point_id not in (None, "") else None,
        at=at, lat=lat, lon=lon,
        course=_number(_get(data, "Cog")),
        speed=_number(_get(data, "Sog")),
        altitude=_number(_get(data, "Alt")),
        battery=_number(_get(data, "Battery")),
    )


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _is_imei(value: str | None) -> bool:
    return bool(value) and value.isdigit() and len(value) == 15


def parse_devices(payload: Any) -> list[IridiumDevice]:
    if isinstance(payload, dict):
        if _get(payload, "error"):
            raise Iridium360Error(f"Iridium360: {_get(payload, 'error')}")
        payload = [payload]
    if not isinstance(payload, list):
        raise Iridium360Error("Iridium360: неожиданный формат ответа")

    devices = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        imei, number = _text(_get(item, "Imei")), _text(_get(item, "Number"))
        # В живом ответе (октябрь 2026) поля перепутаны относительно документации:
        # Imei = «YB#26571» (метка устройства), Number = «300534062293860» (настоящий IMEI).
        # Храним настоящий IMEI — 15 цифр — откуда бы он ни пришёл.
        if not _is_imei(imei) and _is_imei(number):
            imei = number
        if not imei:
            continue
        track = _get(item, "Track")
        raw_points = _get(track, "Points") if isinstance(track, dict) else None
        points = [p for p in map(parse_point, raw_points or []) if p is not None]
        devices.append(IridiumDevice(
            name=_text(_get(item, "Name")),
            number=number,            # для запроса трека — как прислал Iridium
            imei=imei,
            last_position=parse_point(_get(item, "LastKnownPosition")),
            track=tuple(sorted(points, key=lambda p: p.at)),
        ))
    return devices


# ── Клиент ─────────────────────────────────────────────────────────────

class Iridium360Client:
    """
    async with Iridium360Client() as client:
        devices = await client.fetch_devices()                                  # все + последние точки
        devices = await client.fetch_track("12345", point_id_from="987")         # трек одного устройства
    """

    RETRIES = 2            # повторов при сетевой ошибке (у Iridium бывают обрывы)
    RETRY_DELAY = 5.0      # секунд между повторами

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        settings = get_settings()
        self.api_key = settings.iridium360_api_key
        self._http = httpx.AsyncClient(
            base_url=settings.iridium360_api_url, timeout=30.0, transport=transport
        )

    async def __aenter__(self) -> "Iridium360Client":
        return self

    async def __aexit__(self, *exc) -> None:
        await self._http.aclose()

    async def fetch_devices(self) -> list[IridiumDevice]:
        """Все устройства организации с последней известной точкой."""
        return parse_devices(await self._request({}))

    async def fetch_track(
        self,
        number: str,
        point_id_from: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[IridiumPoint]:
        """Точки трека одного устройства (по документации — только по одному за запрос)."""
        params: dict[str, str] = {"number": number, "include_track": "true"}
        if point_id_from:
            params["point_id_from"] = point_id_from
        if date_from:
            params["date_from"] = date_from.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S")   # проверено: без «Z»
        if date_to:
            params["date_to"] = date_to.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S")   # проверено: без «Z»
        devices = parse_devices(await self._request(params))
        mine = [d for d in devices if number in (d.number, d.imei)]
        if not mine and len(devices) == 1:
            mine = devices
        return list(mine[0].track) if mine else []

    async def fetch_raw(self, params: dict[str, str] | None = None) -> Any:
        """Ответ Iridium как есть — для проверки формата (scripts/poll_iridium.py --raw)."""
        return await self._request(params or {})

    async def _request(self, params: dict[str, str]) -> Any:
        if not self.api_key:
            raise Iridium360Error("Не задан IRIDIUM360_API_KEY в backend/.env")
        query = {"token": self.api_key, **params}
        last_error: Exception | None = None
        for attempt in range(self.RETRIES + 1):
            try:
                response = await self._http.get("/devices", params=query)
                break
            except httpx.TransportError as error:     # нет связи, обрыв, таймаут
                last_error = error
                if attempt < self.RETRIES:
                    await asyncio.sleep(self.RETRY_DELAY)
        else:
            raise Iridium360Error(f"Iridium360 недоступен: {last_error!r}") from last_error

        try:
            payload = response.json()
        except ValueError:
            payload = None
        if response.status_code != 200:
            detail = _get(payload, "error") if isinstance(payload, dict) else response.text[:200]
            # Ключ в сообщение об ошибке не попадает: печатаем только код и текст ответа.
            raise Iridium360Error(f"Iridium360 ответил {response.status_code}: {detail}")
        return payload
