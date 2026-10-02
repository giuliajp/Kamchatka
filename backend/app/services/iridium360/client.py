"""
Интеграция с платформой мониторинга Iridium360 (https://www.iridium360.ru).

Ключевые правила из брифа (раздел «Данные трекинга») — не нарушать при реализации:

1. Только backend обращается к API Iridium360. Frontend всегда получает данные от НАШЕГО backend,
   никогда напрямую от Iridium360 — это нужно для лимитов платформы, истории треков и независимости
   от смены поставщика оборудования.

2. Соответствие "устройство (IMEI) → участник → этап" хранится в нашей БД
   (app/models/tracking.py: Tracker и TrackerAssignment), платформа мониторинга такой связи
   не содержит. Точки сохраняем в TrackerPosition — повторно пришедшая точка отклоняется
   ограничением уникальности (tracker_id + recorded_at).

3. Интервал передачи данных настраивается на устройстве (15 сек – 24 часа), тарифицируется за
   сообщение. Базовый интервал на гонке — 20 минут, но код не должен быть жёстко завязан на это
   число. Интервал трекера хранится в БД: Season.tracking_interval_minutes, может
   переопределяться в Stage (свойство Stage.effective_interval_minutes).
   Settings.tracker_poll_interval_seconds — это другое: как часто НАШ бэкенд опрашивает Iridium360.

4. Положение участника — это ВСЕГДА последняя подтверждённая точка с обязательной меткой времени.
   Не рисовать как непрерывное движение. Допускается интерполяция по треку между двумя точками,
   но расчётное положение должно визуально отличаться и быть подписано как расчётное.

5. Скорость считается как средняя на отрезке между двумя переданными точками, а не мгновенная.

6. SOS-сигнал (тревожная кнопка) — обрабатывать и сохранять, но НИКОГДА не отдавать в публичный
   API для frontend. Он должен быть виден только в API для admin-panel (мониторинг оборудования).
   Хранится в отдельной таблице TrackerAlert, а не в позициях — чтобы не утёк на публичную карту.

7. Официальное время прохождения контрольных пунктов — НЕ из трекера, а из ручных судейских
   отметок через admin-panel. При расхождении — приоритет у судейской отметки.

Про асинхронность: используем httpx.AsyncClient, НЕ requests — requests блокирует цикл событий,
и пока он ждёт ответа Iridium, сервер не обслуживает никого. Опрос идёт фоновой задачей
по расписанию (задача 2.7), а не внутри запросов пользователей.
"""

import httpx

from app.config import get_settings


class Iridium360Client:
    """
    TODO: реализовать клиент к API Iridium360 (задачи 1.4 и 2.7 в docs/backend-plan.md).

    Понадобится:
    - метод получения текущих позиций всех устройств организации;
    - метод получения истории трека по устройству (для режима повтора этапа);
    - периодический фоновый опрос (например, APScheduler AsyncIOScheduler)
      с интервалом Settings.tracker_poll_interval_seconds;
    - нормализация и сохранение в БД через app/models;
    - отдельная обработка SOS-сигнала (см. пункт 6 выше).

    Использование (когда будет реализован):
        async with Iridium360Client() as client:
            positions = await client.fetch_current_positions()
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.api_url = settings.iridium360_api_url
        self.api_key = settings.iridium360_api_key
        self._http = httpx.AsyncClient(base_url=self.api_url, timeout=30.0)

    async def __aenter__(self) -> "Iridium360Client":
        return self

    async def __aexit__(self, *exc) -> None:
        await self._http.aclose()

    async def fetch_current_positions(self):
        raise NotImplementedError

    async def fetch_device_history(self, imei: str):
        raise NotImplementedError
