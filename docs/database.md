# База данных — справочник таблиц

Описание предметной области, правила и схема связей — **`docs/domain.md`**.
Здесь — техническая справка.

- PostgreSQL 17 в Docker Compose (локально и на сервере), драйвер `asyncpg`.
- SQLAlchemy 2.0 (асинхронно), базовый класс `Base` из `backend/app/db.py`.
- Миграции — Alembic, `backend/migrations/versions/`:
  - `0001` — структура (16 таблиц);
  - `0002` — справочник дисциплин 2026 года;
  - `0003` — перенос штрафов с результата этапа на участие в гонке;
  - `0004` — программа, FAQ и зрительские локации (`down_revision = "0003"`);
  - `0005` — админка, журнал отметок КП и поддержка участников;
  - `0006` — сезонный контент, типы событий и контакты (`down_revision = "0005"`).
- Время — `TIMESTAMP WITH TIME ZONE` в UTC. Длительности — целые секунды.
- Перечисления хранятся строкой со **значением** элемента (`"preliminary"`, `"dnf"`).
- Связи загружаются явно через `selectinload` — ленивая загрузка запрещена (`lazy="raise_on_sql"`).

| Таблица | Модель | Файл |
|---|---|---|
| `races` | Race | `race.py` |
| `disciplines` | Discipline | `race.py` |
| `participants` | Participant | `race.py` |
| `race_participants` | RaceParticipant | `race.py` |
| `stages` | Stage | `stage.py` |
| `checkpoints` | Checkpoint | `stage.py` |
| `stage_checkpoints` | StageCheckpoint | `stage.py` |
| `checkpoint_passes` | CheckpointPass | `stage.py` |
| `protocols` | Protocol | `protocol.py` |
| `stage_results` | StageResult | `protocol.py` |
| `penalties` | Penalty | `protocol.py` |
| `result_change_log` | ResultChangeLog | `protocol.py` |
| `tracker_devices` | TrackerDevice | `tracking.py` |
| `tracker_assignments` | TrackerAssignment | `tracking.py` |
| `tracker_positions` | TrackerPosition | `tracking.py` |
| `tracker_alerts` | TrackerAlert | `tracking.py` |
| `spectator_locations` | SpectatorLocation | `content.py` |
| `program_events` | ProgramEvent | `content.py` |
| `faq_items` | FaqItem | `content.py` |
| `organizer_contacts` | OrganizerContact | `content.py` |
| `admin_users` | AdminUser | `admin.py` |
| `support_subscriptions` | SupportSubscription | `support.py` |
| `checkpoint_pass_log` | CheckpointPassLog | `stage.py` |

После миграции `0006` — **23 таблицы приложения** и служебная `alembic_version`.
В `0005` добавлены `admin_users`, `support_subscriptions` и `checkpoint_pass_log`.

В текущей схеме `penalties.race_participant_id` ссылается на `race_participants.id`.
Штрафы относятся к участнику за гонку; общая сумма вычисляется по его записям `Penalty`.
Связи штрафа с результатом этапа и колонки `stage_results.penalty_seconds` нет.
Миграция `0003` сохраняет записи штрафов и времена этапов, удаляет прежнюю сумму
штрафов этапа и проверку «итог = чистое + штраф».

## Контент — миграция `0004`

`spectator_locations` хранит название, широту и долготу; описание, адрес и описание
проезда необязательны. `program_events` — название события и обязательное время
начала; описание, время окончания и `location_id` необязательны.
`faq_items` — вопрос и ответ. В исходной миграции `0004` контент общий для приложения, без ссылки на гонку.

У всех трёх моделей есть `sort_order` (по умолчанию 0), `is_published`
(по умолчанию `false`), `created_at` и `updated_at`. Значения по умолчанию
задаются SQLAlchemy при работе через ORM.

Внешний ключ `program_events.location_id` ссылается на `spectator_locations.id`
с `ON DELETE SET NULL`: удаление локации сохраняет события. Для `location_id`
и `start_at` созданы индексы.

Ограничения базы проверяют диапазоны координат, неотрицательный `sort_order`
и окончание события не раньше начала. Откат `0004` удаляет три таблицы контента
вместе с их данными. Миграция создаёт структуру; примеры загружаются отдельно
через [seed_content.py](../backend/scripts/seed_content.py).

Проверки целостности (CHECK) — в `__table_args__` моделей; список с объяснениями — в `domain.md`.


## Сезонный контент — миграция `0006`

Миграция `0006` продолжает `0005`. Перед добавлением обязательных колонок
очищает демонстрационные `program_events` и `spectator_locations`; FAQ и остальные
данные сохраняются. Откат возвращает структуру `0005`, но не удалённые примеры.

`program_events` и `spectator_locations` получают обязательный `race_id` с FK на
`races.id` (`ON DELETE CASCADE`) и индексом. `stage_id` необязателен и индексирован.
Составной FK `(stage_id, race_id)` на `stages(id, race_id)` проверяет принадлежность
этапа сезону. Для него в `stages` добавлено `uq_stages_id_race`.
Прямое удаление используемого этапа запрещено: сначала нужно снять ссылки контента.

`event_type` обязателен: `stage_start / stage_finish / festival`.
`location_type` обязателен: `start / finish / festival / viewpoint`.
Оба перечисления — `VARCHAR(32)` с проверкой допустимых значений, без значения
по умолчанию: автор контента должен выбрать тип явно. `stage_id` допускает `null`
при любом типе. `location_id` события сохраняет прежний `ON DELETE SET NULL`.
API скрывает вложенную локацию другого сезона.

Новая таблица `organizer_contacts`: `id`, обязательный `title VARCHAR(200)`,
необязательные `name VARCHAR(200)`, `phone VARCHAR(100)`, `email VARCHAR(320)`,
`url VARCHAR(2000)`. Общие поля: `sort_order >= 0` (ORM default 0), `is_published`
(ORM default false), `created_at`, `updated_at`. Контакты и FAQ не зависят от сезона.

Откат — `python -m alembic -c backend/alembic.ini downgrade 0005`.
