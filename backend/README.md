# Backend — API «Авача»

Python, **Flask**. Собственный API, база данных, хранение истории треков.
Хостинг на территории РФ, соответствие 152-ФЗ.

План работ и распределение задач — `docs/backend-plan.md`.
Таблицы базы — `docs/database.md`. Адреса API — `docs/api.md`.

---

## Запуск с нуля (пошагово, для VS Code)

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

Виртуальное окружение — отдельная «коробка» для библиотек проекта,
чтобы они не смешивались с другими программами на компьютере.

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

Для локальной работы менять в нём ничего не нужно: база будет обычным файлом SQLite,
PostgreSQL устанавливать не надо.

### 6. Создать базу данных

```
flask db upgrade
```

Создастся файл `instance/avacha.db` со всеми таблицами.

### 7. Запустить сервер

```
python run.py
```
(или `flask run` — работает так же)

Откройте в браузере: http://127.0.0.1:8000/health

Должно появиться:
```json
{ "data": { "database": "ok", "env": "development", "status": "ok" }, "error": null }
```

Остановить сервер: `Ctrl+C` в терминале.

### 8. Запустить тесты

Сервер для этого запускать не нужно:
```
pytest -v
```
Внизу должно быть `10 passed`.

---

## Частые проблемы

| Ошибка | Что делать |
|---|---|
| `python` не найден | Windows: переустановите Python с галочкой «Add to PATH». macOS: пишите `python3` |
| `No module named flask` | Не включено окружение — шаг 3 (activate) |
| `Could not locate a Flask application` | Вы не в папке `backend` — выполните `cd backend` |
| `Address already in use` | Сервер уже запущен в другом терминале — остановите его (`Ctrl+C`) |

Если ошибки нет в таблице — скопируйте её текст целиком и пришлите в чат команды.

---

## Структура

```
backend/
├── requirements.txt          # зависимости
├── .env.example              # шаблон настроек — скопировать в .env
├── .flaskenv                 # как команды flask находят приложение (порт 8000)
├── run.py                    # точка входа для локального запуска
├── migrations/               # история изменений структуры базы
├── tests/                    # тесты (conftest.py — общие заготовки)
└── app/
    ├── __init__.py           # application factory (create_app)
    ├── config.py             # настройки из .env
    ├── extensions.py         # db, migrate, cors
    ├── api/
    │   ├── responses.py      # ok() и error() — единый формат ответов
    │   └── routes/
    │       ├── health.py     # /health — проверка сервиса
    │       └── _template.py  # шаблон нового раздела API
    ├── models/               # таблицы базы (см. docs/database.md)
    ├── schemas/              # сериализация запросов/ответов
    ├── services/
    │   └── iridium360/       # интеграция с платформой трекеров, см. client.py
    └── middleware/
        └── errors.py         # ошибки в формате JSON
```

## Формат ответов API

Все ответы — через `ok()` и `error()` из `app/api/responses.py`:

```json
{ "data": { ... }, "error": null }
{ "data": null, "error": { "code": "not_found", "message": "Не найдено" } }
```

## Как добавить новый раздел API

1. Скопируйте `app/api/routes/_template.py` → например, `app/api/routes/faq.py`,
   переименуйте `bp = Blueprint("faq", __name__)`.
2. Зарегистрируйте blueprint в `app/__init__.py` — пример там закомментирован:
   ```python
   from app.api.routes.faq import bp as faq_bp
   app.register_blueprint(faq_bp, url_prefix="/api/faq")
   ```
3. Напишите тест в `tests/` и добавьте адрес в `docs/api.md`.

## Если изменили модели (таблицы)

```
flask db migrate -m "коротко, что изменилось"
flask db upgrade
```
Первая команда создаст файл в `migrations/versions/` — закоммитьте его вместе с кодом.

## Ключевая логика — трекинг

Полный список правил — в docstring `app/services/iridium360/client.py`. Коротко:

- Backend сам обращается к API Iridium360 по расписанию, нормализует данные и сохраняет у себя.
- **Frontend никогда не обращается к Iridium360 напрямую** — только к нашему backend.
- Соответствие «устройство (IMEI) → участник → этап» хранится в нашей БД (`Tracker`, `TrackerAssignment`).
- Интервал передачи точек трекером (20 минут) хранится в БД в настройках сезона и этапа,
  а не в коде. `TRACKER_POLL_INTERVAL_SECONDS` в `.env` — это как часто наш бэкенд опрашивает Iridium360.
- SOS-сигнал — отдельная таблица `TrackerAlert`, **никогда не отдаётся** в публичный API,
  только в API для admin-panel.
- Официальное время на КП — из судейских отметок (`CheckpointMark`), не из трекера.
  При расхождении приоритет у судейской отметки.

## Правила команды

- Свою задачу берите из `docs/backend-plan.md` и меняйте её статус, когда закончили.
- Каждая задача — в отдельной ветке Git (`feature/faq`, `feature/seed-data`) и через Pull Request.
- Перед Pull Request запустите `pytest` — все тесты должны проходить.
- Время в базе — только UTC.
