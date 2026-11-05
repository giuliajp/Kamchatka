# Сезонный контент: миграция 0006

> Здесь описана историческая миграция 0006. Актуальная цепочка заканчивается 0010;
> [изменения 0008–0010 и проверка заполненной БД](backend-design-update.md#обновление-базы).


Миграция `2026_11_02_0006_season_content.py` продолжает `0005` (админка и
поддержка участников). В цепочке Alembic одна вершина: `0006`.

Применение: `python -m alembic -c backend/alembic.ini upgrade head`.
Миграция очищает демонстрационную программу и локации; удалённые примеры
не восстанавливаются при откате. FAQ, гонки, этапы и данные админки сохраняются.
После upgrade примеры можно заново загрузить `python backend/scripts/seed_content.py`.

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

## Применение и откат

В одной транзакции миграция очищает `program_events`, затем `spectator_locations`,
добавляет ограничения и колонки сезонного контента и создаёт `organizer_contacts`.

`downgrade 0005` удаляет таблицу контактов, новые FK, CHECK, индексы и колонки
сезонного контента, затем `uq_stages_id_race`. События и локации, добавленные после
upgrade, остаются в прежнем формате `0005`, теряя сезон, тип и ссылку на этап.
Повторный upgrade снова очищает их. Контакты при откате удаляются.

Не выполнять `Base.metadata.create_all()` на рабочей БД вместо миграции:
это не обновляет существующие таблицы.

## Проверки

Автоматический интеграционный тест `backend/tests/test_content_migration.py`
использует отдельную временную схему PostgreSQL и настоящие команды Alembic:

1. Upgrade с нуля до `0005`; создание старых примеров, гонки, FAQ и организатора.
2. Upgrade до `0006`; проверка очистки только программы и локаций.
3. `alembic check` против всех моделей, включая модели из `0005`.
4. Запуск настоящего seed дважды; проверка контактов и отсутствия дубликатов.
5. Downgrade до `0005`; сравнение колонок, FK, CHECK, индексов и уникальных
   ограничений с исходной схемой `0005`.
6. Повторный upgrade и `alembic check`; проверка сохранения FAQ и организатора.

Команда полного набора: `.venv/bin/python -m pytest -c backend/pytest.ini backend/tests -q`.
Остальные тесты создают временные схемы из моделей и проверяют API и ограничения.
Рабочая схема приложения при этих проверках не изменяется.


Результат проверки этой ветки после слияния с `main`: **260 passed**.
Цикл upgrade/downgrade и оба вызова `alembic check` проходят в интеграционном тесте.
`alembic heads` возвращает единственную вершину `0006 (head)`.
