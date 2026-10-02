# Backend — API «Авача»

Python, **FastAPI**, асинхронный стек. Собственный API, база данных, хранение истории треков.
Хостинг на территории РФ, соответствие 152-ФЗ.

План работ и распределение задач — `docs/backend-plan.md`.
Таблицы базы — `docs/database.md`. Адреса API — `docs/api.md` и автоматически на `/docs`.

---

## Запуск с нуля (пошагово, для VS Code)

Делайте шаги по порядку. Если что-то не получилось — см. «Частые проблемы» внизу.

### 1. Что установить один раз

1. **Python 3.12** — https://www.python.org/downloads/
   - **Windows:** при установке обязательно поставьте галочку
     **«Add python.exe to PATH»** внизу первого окна.
2. **Git** — https://git-scm.com/downloads
3. **VS Code** — https://code.visualstudio.com/
4. В VS Code откройте вкладку расширений (`Ctrl+Shift+X`) и установите расширение **Python** от Microsoft.

Проверка: откройте терминал в VS Code (**Terminal → New Terminal**) и введите:
```
python --version
```
Должно быть `Python 3.12.x`. На macOS, если команда не найдена, пишите `python3`
вместо `python` во всех командах ниже.

### 2. Открыть проект

1. В VS Code: **File → Open Folder** — выберите папку репозитория `Kamchatka`.
2. Откройте терминал: **Terminal → New Terminal**.
3. Перейдите в папку бэкенда:
   ```
   cd backend
   ```
   **Все команды дальше выполняются в папке `backend`.**

### 3. Создать и включить виртуальное окружение

Виртуальное окружение — отдельная «коробка» для библиотек проекта.

```
python -m venv venv
```

Включить:

- **Windows:**
  ```
  venv\Scripts\activate
  ```
  Если появилась ошибка «выполнение сценариев отключено», один раз выполните
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ответьте `Y` и повторите.
- **macOS / Linux:**
  ```
  source venv/bin/activate
  ```

Признак успеха: в начале строки терминала появилось `(venv)`.

> Окружение нужно включать **каждый раз**, когда открываете новый терминал.

Чтобы VS Code тоже использовал это окружение: `Ctrl+Shift+P` →
**Python: Select Interpreter** → выберите вариант с `venv`.

### 4. Установить библиотеки

```
pip install -r requirements.txt
```

### 5. Создать файл настроек

- **Windows:** `copy .env.example .env`
- **macOS / Linux:** `cp .env.example .env`

Для локальной работы менять в нём ничего не нужно: база — обычный файл SQLite,
PostgreSQL устанавливать не надо.

### 6. Создать базу данных

```
alembic upgrade head
```

Создастся файл `instance/avacha.db` со всеми таблицами.

### 7. Запустить сервер

```
python run.py
```

Откройте в браузере:
- http://127.0.0.1:8000/health — проверка. Должно быть:
  ```json
  {"data":{"status":"ok","database":"ok","env":"development"},"error":null}
  ```
- http://127.0.0.1:8000/docs — **документация API**. Здесь видны все адреса,
  и любой можно попробовать кнопкой «Try it out».

Сервер сам перезапускается, когда вы сохраняете изменения в коде.
Остановить: `Ctrl+C` в терминале.

### 8. Запустить тесты

Сервер для этого запускать не нужно:
```
pytest -v
```
Внизу должно быть `12 passed`.

---

## Частые проблемы

| Ошибка | Что делать |
|---|---|
| `python` не найден | Windows: переустановите Python с галочкой «Add to PATH». macOS: пишите `python3` |
| `No module named fastapi` | Не включено окружение — шаг 3 (activate) |
| `No module named app` или не находится `.env` | Вы не в папке `backend` — выполните `cd backend` |
| `Address already in use` | Сервер уже запущен в другом терминале — остановите его (`Ctrl+C`) |
| `no such table` | Не применены миграции — шаг 6 |

Если ошибки нет в таблице — скопируйте её текст целиком и пришлите в чат команды.

---

## Структура

```
backend/
├── requirements.txt          # зависимости
├── .env.example              # шаблон настроек — скопировать в .env
├── run.py                    # точка входа для локального запуска
├── alembic.ini, migrations/  # миграции — история изменений структуры базы
├── pytest.ini, tests/        # тесты (conftest.py — общие заготовки)
└── app/
    ├── main.py               # сборка приложения: CORS, ошибки, маршруты
    ├── config.py             # настройки из .env
    ├── db.py                 # подключение к базе, Base, сессии
    ├── api/
    │   ├── deps.py           # зависимости: SessionDep — сессия базы для эндпоинта
    │   └── routes/
    │       ├── health.py     # /health — проверка сервиса
    │       └── _template.py  # шаблон нового раздела API
    ├── models/               # таблицы базы (см. docs/database.md)
    ├── schemas/              # Pydantic-схемы: что API принимает и отдаёт
    │   └── common.py         # ApiResponse и ok() — единый формат ответов
    ├── services/
    │   └── iridium360/       # интеграция с платформой трекеров, см. client.py
    └── middleware/
        └── errors.py         # ошибки в едином JSON-формате
```

## Формат ответов API

```json
{ "data": { ... }, "error": null }
{ "data": null, "error": { "code": "not_found", "message": "Не найдено", "details": null } }
```

Успех — `return ok(данные)` с `response_model=ApiResponse[Схема]`.
Ошибка — `raise HTTPException(status_code=404, detail="Участник не найден")`.
Неверные входные данные FastAPI отклоняет сам: код `validation_error`, в `details` — какие поля.

## Как добавить новый раздел API

1. Скопируйте `app/api/routes/_template.py` → например, `app/api/routes/faq.py`.
2. Опишите схемы ответа в `app/schemas/faq.py`.
3. Подключите в `app/main.py`:
   ```python
   from app.api.routes import faq
   app.include_router(faq.router, prefix="/api/faq")
   ```
4. Напишите тест в `tests/` (пример — `tests/test_api_basics.py`). Адрес сам появится на `/docs`.

## Правила асинхронного кода — важно

Сервер работает в одном цикле событий: пока одна функция ждёт базу,
он обслуживает других. Но **одна блокирующая операция останавливает сервер для всех**.

| Нельзя внутри `async def` | Вместо этого |
|---|---|
| `requests.get(...)` | `httpx.AsyncClient` и `await client.get(...)` |
| `time.sleep(5)` | `await asyncio.sleep(5)` |
| Синхронный драйвер базы | `await session.execute(...)` (у нас уже async) |
| Блокирующая библиотека без async | `await asyncio.to_thread(функция, аргументы)` |
| Долгий расчёт (результаты, разбор GPX) | Считать в фоне заранее и сохранять, а в запросе отдавать готовое |

**Связанные данные загружаем явно** — «ленивая» загрузка в async запрещена:

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

stmt = select(Entry).options(selectinload(Entry.participant))
entries = (await session.execute(stmt)).scalars().all()
```

Если забыть `selectinload` и обратиться к `entry.participant` — будет ошибка
(у всех связей стоит `lazy="raise_on_sql"`). Это специально: так проблему видно сразу.
Примеры — в `tests/test_models.py`.

## Если изменили модели (таблицы)

```
alembic revision --autogenerate -m "коротко, что изменилось"
alembic upgrade head
```
Первая команда создаст файл в `migrations/versions/` — проверьте его глазами и закоммитьте вместе с кодом.

## Ключевая логика — трекинг

Полный список правил — в docstring `app/services/iridium360/client.py`. Коротко:

- Backend сам обращается к API Iridium360 фоновой задачей по расписанию, нормализует данные и сохраняет у себя.
- **Frontend никогда не обращается к Iridium360 напрямую** — только к нашему backend.
- Соответствие «устройство (IMEI) → участник → этап» хранится в нашей БД (`Tracker`, `TrackerAssignment`).
- Интервал передачи точек трекером (20 минут) хранится в БД в настройках сезона и этапа.
  `TRACKER_POLL_INTERVAL_SECONDS` в `.env` — как часто наш бэкенд опрашивает Iridium360.
- SOS-сигнал — отдельная таблица `TrackerAlert`, **никогда не отдаётся** в публичный API, только admin-panel.
- Официальное время на КП — из судейских отметок (`CheckpointMark`), не из трекера.

## Запуск на сервере (позже)

```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```
Перед сервером ставится nginx; статика фронтенда отдаётся им, а не Python.

## Правила команды

- Свою задачу берите из `docs/backend-plan.md` и меняйте её статус, когда закончили.
- Каждая задача — в отдельной ветке Git (`feature/faq`, `feature/seed-data`) и через Pull Request.
- Перед Pull Request запустите `pytest` — все тесты должны проходить.
- Время в базе — только UTC.
