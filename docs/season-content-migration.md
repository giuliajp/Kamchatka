# Сезонный контент: передача для миграции 0006

Ветка `feature/season-content` содержит модели, публичное API, seed и тесты.
Файлы миграций намеренно не создавались и не изменялись. Существующая БД остаётся
на прежней схеме; новый код контента требует миграции перед запуском.

## Изменения схемы

Источник истины — `backend/app/models/content.py` и `stage.py`.

| Таблица | Добавления |
| --- | --- |
| `program_events` | `race_id INTEGER NOT NULL`, `event_type VARCHAR(32) NOT NULL`, `stage_id INTEGER NULL` |
| `spectator_locations` | `race_id INTEGER NOT NULL`, `location_type VARCHAR(32) NOT NULL`, `stage_id INTEGER NULL` |
| `stages` | `UNIQUE (id, race_id)` с именем `uq_stages_id_race` |
| `organizer_contacts` | Новая таблица, поля ниже |

Для обеих сезонных таблиц:

- FK `race_id → races.id`, `ON DELETE CASCADE`.
- Составной FK `(stage_id, race_id) → stages(id, race_id)`, `ON DELETE RESTRICT`.
  Имена: `fk_program_events_stage_race`, `fk_spectator_locations_stage_race`.
  При `stage_id = NULL` этап не требуется. Прямое удаление используемого этапа
  требует предварительно очистить ссылки; удаление гонки удаляет её контент.
- Отдельные индексы на `race_id` и `stage_id`, имена по naming convention проекта.
- CHECK `event_type IN ('stage_start', 'stage_finish', 'festival')` и
  `location_type IN ('start', 'finish', 'festival', 'viewpoint')`.
  Имена после naming convention: `ck_program_events_event_type_valid`,
  `ck_spectator_locations_location_type_valid`.
- Значений по умолчанию у сезона и типа нет.

Существующий FK `program_events.location_id` сохраняется (`ON DELETE SET NULL`).
API не возвращает вложенную локацию другого сезона. Административных операций
записи контента пока нет; при их добавлении нужно валидировать сезон локации.

`organizer_contacts`:

| Поле | Тип / обязательность |
| --- | --- |
| `id` | INTEGER, PK, автоинкремент |
| `title` | VARCHAR(200), NOT NULL |
| `name` | VARCHAR(200), NULL |
| `phone` | VARCHAR(100), NULL |
| `email` | VARCHAR(320), NULL |
| `url` | VARCHAR(2000), NULL |
| `sort_order` | INTEGER, NOT NULL, ORM default 0 |
| `is_published` | BOOLEAN, NOT NULL, ORM default false |
| `created_at`, `updated_at` | TIMESTAMP WITH TIME ZONE, NOT NULL, ORM defaults как у остального контента |

CHECK `ck_organizer_contacts_sort_order_non_negative`: `sort_order >= 0`.
Контакты общие для сезонов. Поля связи и типы API описаны в [api.md](api.md).

## Порядок будущей миграции

1. Получить миграцию `0005` коллеги и установить её фактический revision как
   `down_revision` будущей `0006`. Проверить отсутствие нескольких heads.
2. В одной транзакции очистить демонстрационные `program_events`, затем
   `spectator_locations`. FAQ, гонки, этапы и остальные данные сохраняются.
   Удаление примеров разрешено постановкой задачи; они не восстанавливаются при откате.
3. Добавить `uq_stages_id_race`, новые колонки, FK, CHECK и индексы.
4. Создать `organizer_contacts`.
5. В `downgrade` удалить новую таблицу, FK и индексы контента, затем новые колонки,
   затем `uq_stages_id_race`. Исходные таблицы контента, поля и ограничения `0004`
   должны сохраниться.

Не выполнять `Base.metadata.create_all()` на рабочей БД вместо миграции:
это не обновляет существующие таблицы.

## Проверки после получения миграции

- На отдельной тестовой БД: upgrade до `0005`, добавить демонстрационные записи
  старой схемы, upgrade до `0006`; убедиться, что очищен только сезонный контент.
- `python -m pytest -c backend/pytest.ini backend/tests`.
  Текущие тесты сами создают временные схемы из моделей, поэтому проверяют API
  и ограничения без миграций. Они не подтверждают корректность Alembic-перехода.
- `python -m alembic -c backend/alembic.ini check` после upgrade до `0006`.
- `downgrade` до фактического revision `0005`, затем повторный `upgrade head`.
- Повторить `alembic check`, запустить seed и проверить `/program`, `/locations`, `/contacts`.

Пока миграции нет, успешные `alembic check`, downgrade и повторный upgrade
не входят в выполненные проверки этой ветки.


## Проверено до создания миграции

- Полный backend-набор: **238 passed**, команда
  `.venv/bin/python -m pytest -c backend/pytest.ini backend/tests -q --tb=short`.
- Ruff по изменённым Python-файлам: проверки `E4,E7,E9,F,I,B` проходят.
- `git diff --check` проходит; каталог `backend/migrations` не изменён.
- Тесты работают с PostgreSQL во временных схемах из моделей. Существующая схема
  приложения не обновлялась, seed в неё не запускался.
