# Backend — API «Авача»

Python, **FastAPI**, асинхронный стек. Собственный API, база данных, хранение истории треков.
Хостинг на территории РФ, соответствие 152-ФЗ.

Локально PostgreSQL работает в Docker Compose, backend запускается через Python.
Реализованы модели, начальная миграция и `/health`. Бизнес-эндпоинты
и фоновый опрос Iridium360 пока находятся в разработке.

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
5. Установите и запустите Docker с Docker Compose.

Проверка: откройте терминал в VS Code (**Terminal → New Terminal**) и введите:
```
python --version
```
Должно быть `Python 3.12.x`. На macOS, если команда не найдена, пишите `python3`
вместо `python` во всех командах ниже.

### 2. Открыть проект

1. В VS Code: **File → Open Folder** — выберите папку репозитория `Kamchatka`.
2. Откройте терминал: **Terminal → New Terminal**.
3. Убедитесь, что терминал открыт в корне `Kamchatka`, где лежит `compose.yaml`.

**Все команды в этом README выполняются из корня репозитория.**

### 3. Создать и включить виртуальное окружение

Виртуальное окружение — отдельная «коробка» для библиотек проекта.
Используем `.venv` в корне репозитория. Если оно уже есть, пропустите создание.

```
python -m venv .venv
```

Включить:

- **Windows:**
  ```
  .\.venv\Scripts\Activate.ps1
  ```
  Если появилась ошибка «выполнение сценариев отключено», один раз выполните
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ответьте `Y` и повторите.
- **macOS / Linux:**
  ```
  source .venv/bin/activate
  ```

Для Windows cmd используйте `.venv\Scripts\activate.bat`.
Признак успеха: в начале строки терминала появилось `(.venv)`.

> Окружение нужно включать **каждый раз**, когда открываете новый терминал.

Чтобы VS Code тоже использовал это окружение: `Ctrl+Shift+P` →
**Python: Select Interpreter** → выберите Python из корневой `.venv`.

### 4. Установить библиотеки

```
python -m pip install -r backend/requirements.txt
```

### 5. Создать файл настроек

Файл настроек хранится в `backend/.env`. Если он уже существует, сохраните его;
следующие команды нужны только при первой настройке:

- **Windows cmd:** `copy backend\.env.example backend\.env`
- **Windows PowerShell:** `Copy-Item backend/.env.example backend/.env`
- **macOS / Linux:** `cp backend/.env.example backend/.env`

Локально и на сервере используется PostgreSQL. Заполните `POSTGRES_*` в
`backend/.env`, задав свой `POSTGRES_PASSWORD`. Backend собирает адрес подключения
из этих параметров; отдельный `DATABASE_URL` не нужен.
При локальном запуске backend используйте `POSTGRES_HOST=127.0.0.1`.

Из корня репозитория запустите базу:

```bash
docker compose --env-file backend/.env up -d --wait --wait-timeout 90 db
docker compose --env-file backend/.env ps
docker compose --env-file backend/.env exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Команда `up --wait` дожидается готовности базы. В `ps` ожидается статус
`Up … (healthy)`. Дополнительная проверка `pg_isready` должна вернуть `accepting connections`.

Compose по умолчанию ищет `.env` в корне, поэтому параметр
`--env-file backend/.env` указывайте при каждой команде Compose, в том числе `down`.
Корневой `.env` не нужен. Данные PostgreSQL сохраняются в volume `postgres_data`.
Параметры пользователя, пароля и базы применяются при первой инициализации volume.

### 6. Создать базу данных

```
python -m alembic -c backend/alembic.ini upgrade head
python -m alembic -c backend/alembic.ini current
```

Таблицы создадутся в PostgreSQL; контейнер базы должен быть запущен.
`python -m alembic -c backend/alembic.ini current` должен показать отметку `(head)`.
Чтобы посмотреть таблицы, в другом терминале из корня выполните:

```bash
docker compose --env-file backend/.env exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

Ожидаются 16 таблиц приложения и `alembic_version`. Миграции создают структуру
и справочник дисциплин; остальные таблицы пустые.

### 7. Запустить сервер

```
python backend/run.py
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

PostgreSQL должен быть запущен; сервер API запускать не нужно.
Каждый тест создаёт отдельную временную схему и удаляет её после завершения:

Откройте новый терминал в корне проекта, активируйте `.venv` по шагу 3
(из корня путь на Linux/macOS — `source .venv/bin/activate`), затем:

```
python -m pytest -c backend/pytest.ini backend/tests -v
```
Все тесты должны пройти.
Тесты создают таблицы из моделей; они не проверяют применение миграций к основной схеме.

## Запуск в PyCharm

### 1. Открыть проект и настроить окружение

Установите Python 3.12, Git, PyCharm и Docker с Docker Compose.
Запустите Docker. Откройте корень репозитория `Kamchatka` через **File → Open**.
Откройте вкладку **Terminal**. Все команды ниже выполняются из корня проекта.

Если корневой `.venv` ещё нет, создайте его:

```bash
python -m venv .venv
```

На Linux/macOS при отсутствии команды `python` используйте `python3`.

Активируйте окружение в терминале:

- **Linux/macOS:** `source .venv/bin/activate`
- **Windows PowerShell:** `.\.venv\Scripts\Activate.ps1`
- **Windows cmd:** `.venv\Scripts\activate.bat`

В настройках **Python Interpreter** выберите `.venv/bin/python` на Linux/macOS
или `.venv\Scripts\python.exe` на Windows. Выбор интерпретатора проекта
и активация окружения в терминале — отдельные действия.

### 2. Установить зависимости и создать настройки

```bash
python -m pip install -r backend/requirements.txt
```

Если `backend/.env` уже существует, сохраните его. Иначе скопируйте шаблон:

- **Linux/macOS:** `cp backend/.env.example backend/.env`
- **Windows:** `copy backend\.env.example backend\.env` в cmd
  или `Copy-Item backend/.env.example backend/.env` в PowerShell.

В `backend/.env` задайте `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_HOST=127.0.0.1` и `POSTGRES_PORT=5432` (либо другой свободный порт).
Замените шаблонные `POSTGRES_PASSWORD` и `SECRET_KEY` своими значениями.
Backend собирает подключение из `POSTGRES_*` и автоматически читает `backend/.env`.

### 3. Запустить PostgreSQL

```bash
docker compose --env-file backend/.env up -d --wait --wait-timeout 90 db
docker compose --env-file backend/.env ps
docker compose --env-file backend/.env exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Команда `up --wait` дожидается готовности базы. Ожидаются статус контейнера
`Up … (healthy)` и ответ дополнительной проверки `accepting connections`.
При ошибке посмотрите логи:

```bash
docker compose --env-file backend/.env logs --tail=100 db
```

Данные сохраняются в volume `postgres_data`. Пользователь, пароль и имя базы
из `.env` применяются при первой инициализации volume.

### 4. Применить миграции и проверить таблицы

```bash
python -m alembic -c backend/alembic.ini upgrade head
python -m alembic -c backend/alembic.ini current
docker compose --env-file backend/.env exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

Ожидаются отметка `(head)`, 16 таблиц приложения и `alembic_version`.
Миграции создают структуру и справочник дисциплин; остальные таблицы пустые.

### 5. Запустить backend и проверить API

В терминале:

```bash
python backend/run.py
```

Либо в **Run → Edit Configurations** добавьте конфигурацию **Python**:

| Поле | Значение |
|---|---|
| Script path | Файл `backend/run.py` внутри репозитория |
| Working directory | Корень репозитория `Kamchatka` |
| Python interpreter | Python из корневой `.venv` |
| Parameters | Оставьте пустым |

Выберите пути через диалог выбора файлов, сохраните конфигурацию и нажмите **Run**.
Ожидается сообщение `Application startup complete`.

Откройте http://127.0.0.1:8000/health. Ожидаемый ответ:

```json
{"data":{"status":"ok","database":"ok","env":"development"},"error":null}
```

Документация API доступна по адресу http://127.0.0.1:8000/docs.
Для остановки используйте `Ctrl+C` в терминале или **Stop** в конфигурации запуска.

### 6. Запустить тесты

Оставьте PostgreSQL запущенным. В новом терминале из корня активируйте `.venv`
командой для вашей системы из пункта 1 этого раздела, затем выполните:

```bash
python -m pytest -c backend/pytest.ini backend/tests -v
```

Ожидается `21 passed`. Сервер API для тестов запускать не нужно.
Тесты используют отдельные временные схемы PostgreSQL и удаляют их после завершения.

Для запуска кнопкой создайте конфигурацию **Python tests → pytest** с целью
`backend/tests`, рабочей папкой — корнем `Kamchatka` и интерпретатором из `.venv`.
В **Additional Arguments** укажите `-c backend/pytest.ini`.

---

## Частые проблемы

| Ошибка | Что делать |
|---|---|
| `python` не найден | Windows: переустановите Python с галочкой «Add to PATH». macOS: пишите `python3` |
| `No module named fastapi` | Не включено окружение — шаг 3 (activate) |
| `No module named app` | Используйте команды из README с путями `backend/` и рабочую папку — корень проекта |
| Ошибка настроек `POSTGRES_*` | Проверьте наличие и заполнение `backend/.env` |
| `Address already in use` | Сервер уже запущен в другом терминале — остановите его (`Ctrl+C`) |
| `relation ... does not exist` | Не применены миграции — шаг 6 |

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

1. Скопируйте `backend/app/api/routes/_template.py` → например, `backend/app/api/routes/faq.py`.
2. Опишите схемы ответа в `backend/app/schemas/faq.py`.
3. Подключите в `backend/app/main.py`:
   ```python
   from app.api.routes import faq
   app.include_router(faq.router, prefix="/api/faq")
   ```
4. Напишите тест в `backend/tests/` (пример — `backend/tests/test_api_basics.py`). Адрес сам появится на `/docs`.

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

stmt = select(RaceParticipant).options(selectinload(RaceParticipant.participant))
items = (await session.execute(stmt)).scalars().all()
```

Если забыть `selectinload` и обратиться к `item.participant` — будет ошибка
(у всех связей стоит `lazy="raise_on_sql"`). Это специально: так проблему видно сразу.
Примеры — в `backend/tests/test_models.py`.

## Если база была создана старой миграцией

12 октября структура базы была пересобрана (16 таблиц вместо 12), начальная миграция заменена.
Если у вас уже есть локальная база со старыми таблицами, пересоздайте её — данные в ней тестовые:

```bash
docker compose --env-file backend/.env down -v
docker compose --env-file backend/.env up -d --wait --wait-timeout 90 db
python -m alembic -c backend/alembic.ini upgrade head
```

`down -v` удаляет volume с данными PostgreSQL. На сервере так делать нельзя — там только новые миграции.

## Если изменили модели (таблицы)

```
python -m alembic -c backend/alembic.ini revision --autogenerate -m "коротко, что изменилось"
python -m alembic -c backend/alembic.ini upgrade head
```
Первая команда создаст файл в `backend/migrations/versions/` — проверьте его глазами и закоммитьте вместе с кодом.

## Ключевая логика — трекинг

Полный список правил — в docstring `backend/app/services/iridium360/client.py`.
Ниже описано планируемое поведение: клиент и фоновый опрос пока не реализованы.

- Backend сам обращается к API Iridium360 фоновой задачей по расписанию, нормализует данные и сохраняет у себя.
- **Frontend никогда не обращается к Iridium360 напрямую** — только к нашему backend.
- Соответствие «устройство (IMEI) → участник → этап» хранится в нашей БД (`TrackerDevice`, `TrackerAssignment`).
- Интервал передачи точек трекером (20 минут) хранится в БД в настройках сезона и этапа.
  `TRACKER_POLL_INTERVAL_SECONDS` в `.env` — как часто наш бэкенд опрашивает Iridium360.
- SOS-сигнал — отдельная таблица `TrackerAlert`, **никогда не отдаётся** в публичный API, только admin-panel.
- Официальные результаты — только из судейских протоколов (`Protocol`, `StageResult`), не из трекера и не из отметок на КП.
- Штрафы относятся к участию в гонке (`Penalty.race_participant_id` → `RaceParticipant.id`).
  Их общая сумма вычисляется за гонку и показывается отдельно; к времени из протокола штрафы повторно не прибавляются.

## Запуск на сервере (позже)

```
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --workers 4
```
Перед сервером ставится nginx; статика фронтенда отдаётся им, а не Python.

## Правила команды

- Свою задачу берите из `docs/backend-plan.md` и меняйте её статус, когда закончили.
- Каждая задача — в отдельной ветке Git (`feature/faq`, `feature/seed-data`) и через Pull Request.
- Перед Pull Request запустите `python -m pytest -c backend/pytest.ini backend/tests` — все тесты должны проходить.
- Время в базе — только UTC.
