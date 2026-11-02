# API «Авача»

Адреса API начинаются с `/api` (кроме служебного `/health`). Локально: `http://127.0.0.1:8000/...`

**Актуальная документация генерируется автоматически:** http://127.0.0.1:8000/docs
(Swagger — все адреса, схемы ответов, кнопка «Try it out»). Этот файл — обзор и план.

## Формат ответов

Каждый ответ имеет одинаковую структуру.

Успех:
```json
{ "data": { ... }, "error": null }
```

Ошибка:
```json
{ "data": null, "error": { "code": "not_found", "message": "Не найдено", "details": null } }
```

`code` — для программы (фронтенд проверяет его), `message` — текст для человека.

Коды ошибок: `bad_request` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404),
`method_not_allowed` (405), `validation_error` (422), `too_many_requests` (429),
`internal_error` (500), `database_unavailable` (503).

При `validation_error` в `details` — список неверных полей:
```json
{ "data": null, "error": { "code": "validation_error", "message": "Данные заполнены неверно",
  "details": [ { "field": "bib_number", "problem": "Input should be a valid integer" } ] } }
```

Даты и время всегда в UTC, формат ISO 8601: `2027-03-01T02:00:00+00:00`
или эквивалентная запись `2027-03-01T02:00:00Z`.

---

## Готовые адреса

### `GET /health`
Проверка, что сервер и база данных работают. Без префикса `/api` — для мониторинга на сервере.

Ответ `200`:
```json
{ "data": { "status": "ok", "database": "ok", "env": "development" }, "error": null }
```
Ответ `503`, если база недоступна: `error.code = "database_unavailable"`.

### Публичная часть (готово: задачи 2.3, 2.4, 2.5)

Подробные схемы ответов — на `/docs`. Результаты строятся **только из опубликованных**
протоколов. Длительности приходят дважды: в секундах (`*_seconds`) и строкой
«ЧЧ:ММ:СС» (`*_time`, часы могут быть больше 24). Если время этапа `null` — показываем «—».

| Метод и адрес | Что отдаёт |
|---|---|
| `GET /api/races` | Все гонки, новые сверху (архив) |
| `GET /api/races/current` | Текущая гонка (`is_current`, иначе самая свежая): дисциплины с числом участников, этапы. `404`, если гонок нет |
| `GET /api/races/{id}` | То же для конкретной гонки |
| `GET /api/races/{id}/stages` | Этапы по порядку: номер, название, км, даты, статус |
| `GET /api/races/{id}/participants` | Участники. Параметры: `discipline` (код), `q` (фамилия, имя или номер), `sort` = `start_number` / `place` / `name`. Сортировка по месту — внутри дисциплин |
| `GET /api/participants/{id}` | Карточка спортсмена и его гонки по годам (место, итог, отставание, сумма штрафов) |
| `GET /api/races/{id}/results` | Общий зачёт: **отдельная таблица на каждую дисциплину**. Параметры: `discipline`, `stage` (зачёт после этапа N) |
| `GET /api/stages/{id}` | Этап: КП по порядку, км, трек GeoJSON, профиль высот |
| `GET /api/stages/{id}/protocols` | Протоколы этапа по дисциплинам: статус, судьи, погода, зачёт после этого этапа |

Строка зачёта (`rows[]`): `place` (пусто у DNF/DNS — они в конце), `start_number`,
ФИО, `region`, `status`, `stages[]` (по этапу: `status`, `time`, `dogs_at_start`,
`dogs_at_finish`, `is_corrected_after_final`), `total_time`, `gap_to_leader`,
`penalties[]` (время, причина, пункт правил), `penalty_total`.

Штрафы относятся к участию в гонке, не к этапу. Сейчас итог = сумма этапов
(`penalty_included_in_stage_times: true`, как в протоколе 2026). Вопрос заказчику открыт —
см. `docs/backend-plan.md`.

Коды дисциплин: `ski_2`, `sled_8`, `sled_8plus` (справочник, может меняться).

### Карта (готово: задача 3.1)

Данные GPS-трекеров — **не официальные** результаты. Фронтенд запрашивает позиции не реже раза в 2 минуты.

| Метод и адрес | Что отдаёт |
|---|---|
| `GET /api/races/{id}/positions` | Последние подтверждённые точки участников этапа. Параметры: `stage` (номер; пусто — текущий), `discipline` |
| `GET /api/race-participants/{id}/track` | Все точки участника по времени. Параметр `stage` (пусто — вся гонка) |

По участнику: `position` (широта, долгота, высота, `position_at`), `previous_position`,
`is_stale`, `km_on_route`, `avg_speed_kmh`, `gps_rank`, `gap_to_leader_km`.

Как показывать (ответы заказчика):
- всегда со временем: «Положение на 14:32»; при `is_stale` — «Последняя подтверждённая точка — 13:40».
  Никогда «остановился», «нет связи», «сошёл»;
- `gps_rank` подписывать «позиция по GPS-трекеру»;
- скорость — «средняя», она посчитана между двумя последними точками;
- если дисциплина есть в `official_protocol_disciplines` — этап по ней закрыт, показывать
  только протокол (`/api/stages/{id}/protocols`), без GPS-позиций.

### Контент: сезоны, типы событий и контакты

Программа и зрительские локации принадлежат сезону (`race_id`), FAQ и контакты
общие для приложения. Адреса доступны без авторизации и возвращают только
опубликованные записи (`is_published = true`).

Код сезонного контента подготовлен без миграции: для существующей БД потребуется
миграция `0006` после `0005`. См. [описание изменений схемы](season-content-migration.md).

| Метод и адрес | Что отдаёт | Сортировка по возрастанию |
|---|---|---|
| `GET /api/program?race_id=&type=` | События программы со вложенной локацией | `start_at`, затем `sort_order`, затем `id` |
| `GET /api/faq` | Вопросы и ответы | `sort_order`, затем `id` |
| `GET /api/locations?race_id=&type=` | Зрительские локации с координатами и описанием проезда | `sort_order`, затем `id` |
| `GET /api/contacts` | Контакты организаторов | `sort_order`, затем `id` |

У `/program` и `/locations` необязательные параметры:

- `race_id` — положительный ID гонки; неизвестный ID возвращает `404`.
  Без параметра выбирается `is_current = true`, иначе самая свежая гонка по году;
  при равном годе — больший ID. Если гонок нет, ответ `200` с пустым списком.
- `type` — для программы `stage_start`, `stage_finish`, `festival`;
  для локаций `start`, `finish`, `festival`, `viewpoint`.
  Без параметра возвращаются все типы выбранного сезона. Неверный тип или формат
  `race_id` возвращает `422`.

Например, `/api/program?race_id=1&type=stage_start` и
`/api/locations?race_id=1&type=viewpoint` запрашивают архив конкретного сезона.
В ответах программы и локаций есть `race_id`, необязательный `stage_id`,
а также `event_type` или `location_type` соответственно.

В событии `end_at` может быть `null`. Если локация не задана, удалена или ещё
не опубликована либо принадлежит другому сезону, событие остаётся в программе с `location: null`.
Одна опубликованная локация может быть вложена в несколько событий.

Пустой раздел или раздел, в котором есть только черновики, возвращает `200`:

```json
{ "data": [], "error": null }
```

Ниже — условные примеры данных для разработки. Заполнение базы описано
в [README backend](../backend/README.md#примеры-контента).

#### Пример `GET /api/program`

Ответ `200`:

```json
{
  "data": [
    {
      "id": 1,
      "race_id": 1,
      "stage_id": null,
      "event_type": "festival",
      "title": "Пример: открытие фестиваля",
      "description": "Демонстрационное событие; дата и время условные.",
      "start_at": "2027-02-06T00:00:00Z",
      "end_at": "2027-02-06T00:30:00Z",
      "location": {
        "id": 1,
        "race_id": 1,
        "stage_id": null,
        "location_type": "start",
        "name": "Пример: стартовая площадка",
        "description": "Условная площадка для проверки карты и программы.",
        "latitude": 53.05,
        "longitude": 158.65,
        "address": "Пример адреса стартовой площадки",
        "how_to_get_there": "Здесь организаторы разместят описание проезда.",
        "sort_order": 0
      },
      "sort_order": 0
    }
  ],
  "error": null
}
```

#### Пример `GET /api/faq`

Ответ `200`:

```json
{
  "data": [
    {
      "id": 1,
      "question": "Пример: где посмотреть программу?",
      "answer": "Здесь организаторы разместят информацию о программе фестиваля.",
      "sort_order": 0
    }
  ],
  "error": null
}
```

#### Пример `GET /api/locations`

Ответ `200`:

```json
{
  "data": [
    {
      "id": 1,
      "race_id": 1,
      "stage_id": null,
      "location_type": "start",
      "name": "Пример: стартовая площадка",
      "description": "Условная площадка для проверки карты и программы.",
      "latitude": 53.05,
      "longitude": 158.65,
      "address": "Пример адреса стартовой площадки",
      "how_to_get_there": "Здесь организаторы разместят описание проезда.",
      "sort_order": 0
    }
  ],
  "error": null
}
```

#### Пример `GET /api/contacts`

```json
{
  "data": [{
    "id": 1,
    "title": "Пример: организационный комитет",
    "name": "Пример контакта",
    "phone": null,
    "email": "organizer@example.org",
    "url": "https://example.org",
    "sort_order": 0
  }],
  "error": null
}
```

У контакта обязательны `id`, `title` и `sort_order`. Поля `name`, `phone`, `email`,
`url` могут быть `null`; служебные поля публикации и аудита не возвращаются.

---

### «Болею за» и отметки КП (готово)

Пользователь определяется по подписанным параметрам запуска VK: фронтенд передаёт
`window.location.search` как есть в заголовке `X-VK-Launch-Params`. Без верной подписи
адреса «моих» данных отвечают `401`. Счётчики и рейтинг доступны всем.

| Метод и адрес | Что делает |
|---|---|
| `GET /api/race-participants/{id}/support` | Число болельщиков, изменение за 24 часа, болею ли я (`null`, если пользователь не определён) |
| `PUT /api/race-participants/{id}/support` | «Болею за». Повторное нажатие ничего не меняет |
| `DELETE /api/race-participants/{id}/support` | Отписаться |
| `GET /api/me/supports?race_id=` | За кого я болею (профиль) |
| `PATCH /api/me/supports/{id}` | `{"notifications_enabled": false}` — выключить push по участнику, не отписываясь |
| `DELETE /api/me/supports?race_id=` | Отписаться от всех |
| `GET /api/races/{id}/support-rating?discipline=` | Рейтинг народной поддержки; равное число болельщиков — одно место |
| `GET /api/race-participants/{id}/checkpoint-passes?stage_id=` | Отметки судей на КП для карточки участника |

В списке участников (`GET /api/races/{id}/participants`) добавлены поля
`supporters_count`, `supporters_change_24h` и сортировка `sort=supporters`.

### Административная панель (готово: задачи 3.2, 3.6)

Вход: `POST /api/admin/login` с `{"login": "...", "password": "..."}` возвращает `token`.
Дальше каждый запрос — с заголовком `Authorization: Bearer <token>`. Токен действует
`ADMIN_TOKEN_TTL_HOURS` (12 ч); выключенный организатор теряет доступ сразу.
Организаторов создаёт `backend/scripts/create_admin.py` (см. README backend).

| Метод и адрес | Что делает |
|---|---|
| `GET /api/admin/me` | Кто вошёл |
| `GET /api/admin/stages/{id}/monitoring` | Трекеры этапа: последняя точка, минут назад, батарея, просрочка, активные SOS, отметки КП. Сначала SOS, потом просрочка |
| `POST /api/admin/checkpoint-passes` | Внести отметку судьи: `race_participant_id`, `stage_checkpoint_id`, `arrived_at`, `departed_at`, `note`. Время — с часовым поясом (`...+12:00` или `...Z`). Повтор на тот же КП — `409` |
| `PATCH /api/admin/checkpoint-passes/{id}` | Исправить отметку |
| `DELETE /api/admin/checkpoint-passes/{id}` | Удалить ошибочную отметку |
| `GET /api/admin/stages/{id}/checkpoint-passes/log` | Журнал правок: кто, когда, было → стало |
| `GET /api/admin/races/{id}/alerts?active=true` | SOS гонки (`active=false` — вместе с закрытыми) |
| `POST /api/admin/alerts/{id}/acknowledge` | Закрыть SOS, `{"note": "причина"}` обязательно |
| `GET /api/admin/races/{id}/support-stats.csv?days=14` | Болельщики по участникам и дням, CSV для Excel |

Просрочка — нет точек дольше `stale_after_minutes` этапа (по умолчанию 45 мин) и только
на идущем этапе. Это состояние устройства: статус каюра не меняется.
SOS из Iridium360 пока не приходит (в API платформы его нет, вопрос в поддержке);
таблица и адреса готовы.

## Запланированные адреса (черновик)

Номера задач — из `docs/backend-plan.md`. Когда адрес готов, переносим его
в раздел «Готовые адреса» с примером ответа.

### Административная панель (только после входа)

| Метод и адрес | Что делает | Задача |
|---|---|---|
| `POST /api/admin/protocols/import` | Загрузка протокола файлом | 3.4 |
| `PATCH /api/admin/stage-results/{id}` | Правка результата (с причиной → журнал) | 3.3 |
| `POST /api/admin/protocols/{id}/publish` | Опубликовать протокол | 3.3 |
| `POST /api/admin/protocols/{id}/finalize` | Утвердить окончательный | 3.3 |
| `POST /api/admin/stage-results/{id}/post-final-correction` | Исправление окончательного (основание, кто утвердил) | 3.3 |
| `GET /api/admin/protocols/{id}/changes` | Журнал правок протокола | 3.3 |
| `/api/admin/participants`, `/stages`, `/checkpoints` | Создание, изменение, удаление | 3.5 |
| `PUT /api/admin/stages/{id}/route` | Загрузить или заменить трек этапа (KML/GPX) | 3.5 |
| `/api/admin/trackers` | Трекеры и привязка к участникам | 3.5 |
| `PUT /api/admin/races/{id}/status` | Переключение режима гонки | 3.5 |
