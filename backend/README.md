# Backend — API «Авача»

Python, **Flask**. Собственный API, база данных, хранение истории треков.
Хостинг на территории РФ, соответствие 152-ФЗ.

## Структура

```
backend/
├── requirements.txt        # зависимости
├── .env.example              # шаблон переменных окружения — скопировать в .env и заполнить
├── run.py                     # точка входа для локального запуска
└── app/
    ├── __init__.py             # application factory (create_app)
    ├── config.py                 # настройки из переменных окружения
    ├── extensions.py              # db, cors — инициализируются в create_app
    ├── api/
    │   └── routes/
    │       └── _template.py        # шаблон blueprint'а — скопировать при создании нового раздела
    ├── models/                     # SQLAlchemy-модели (participant.py — пример)
    ├── schemas/                     # сериализация запросов/ответов (marshmallow или вручную)
    ├── services/
    │   └── iridium360/               # интеграция с платформой трекеров, см. client.py
    └── middleware/                    # обработчики ошибок, проверка VK-авторизации и т.д.
```

## Установка и запуск

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # и заполнить реальными значениями
python run.py
```

После запуска: http://127.0.0.1:8000/health — должен вернуть `{"status": "ok"}`.

## Как добавить новый раздел API

1. Скопируйте `app/api/routes/_template.py` → например, `app/api/routes/map.py`, переименуйте `bp`.
2. Зарегистрируйте blueprint в `app/__init__.py` (`app.register_blueprint(...)`) — пример уже
   закомментирован там же.

## Ключевая логика — трекинг (см. docs/brief-summary.md и комментарии в коде)

Полный список правил — в docstring `app/services/iridium360/client.py`. Коротко:

- Backend сам обращается к API Iridium360 по расписанию, нормализует данные и сохраняет у себя.
- **Frontend никогда не обращается к Iridium360 напрямую** — только к нашему backend.
- Соответствие "устройство (IMEI) → участник → этап" хранится в нашей БД, не в Iridium360.
- Базовый интервал передачи координат — 20 минут (`TRACKER_POLL_INTERVAL_SECONDS` в `.env`),
  но должен быть настраиваемым, а не захардкоженным.
- SOS-сигнал с трекеров — обрабатывать, но **никогда не отдавать** в публичный API для frontend,
  только в API для admin-panel.
- Официальное время на КП — из ручного ввода судейских отметок (admin-panel), не из трекера.
- При расхождении данных трекера и судейской отметки — приоритет у судейской отметки.
