# База данных — справочник таблиц

Описание предметной области, правила и схема связей — **`docs/domain.md`**.
Здесь — техническая справка.

- PostgreSQL 17 в Docker Compose (локально и на сервере), драйвер `asyncpg`.
- SQLAlchemy 2.0 (асинхронно), базовый класс `Base` из `backend/app/db.py`.
- Миграции — Alembic, `backend/migrations/versions/`:
  - `0001` — структура (16 таблиц);
  - `0002` — справочник дисциплин 2026 года;
  - `0003` — перенос штрафов с результата этапа на участие в гонке.
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

В текущей схеме `penalties.race_participant_id` ссылается на `race_participants.id`.
Штрафы относятся к участнику за гонку; общая сумма вычисляется по его записям `Penalty`.
Связи штрафа с результатом этапа и колонки `stage_results.penalty_seconds` нет.
Миграция `0003` сохраняет записи штрафов и времена этапов, удаляет прежнюю сумму
штрафов этапа и проверку «итог = чистое + штраф».

Проверки целостности (CHECK) — в `__table_args__` моделей; список с объяснениями — в `domain.md`.
