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

Даты и время всегда в UTC, формат ISO 8601: `2027-03-01T02:00:00+00:00`.

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

---

## Запланированные адреса (черновик)

Номера задач — из `docs/backend-plan.md`. Когда адрес готов, переносим его
в раздел «Готовые адреса» с примером ответа.

### Публичная часть (мини-приложение)

| Метод и адрес | Что отдаёт | Задача |
|---|---|---|
| `GET /api/races/{id}/positions` | Последние позиции участников со временем и флагом «неактуально» | 3.1 |
| `GET /api/race-participants/{id}/track` | История точек участника | 3.1 |
| `GET /api/program`, `/api/locations`, `/api/faq` | Контент | 2.7 |


### Административная панель (только после входа)

| Метод и адрес | Что делает | Задача |
|---|---|---|
| `POST /api/admin/login` | Вход организатора | 3.2 |
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
