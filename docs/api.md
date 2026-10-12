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

---

## Запланированные адреса (черновик)

Номера задач — из `docs/backend-plan.md`. Когда адрес готов, переносим его
в раздел «Готовые адреса» с примером ответа.

### Публичная часть (мини-приложение)

| Метод и адрес | Что отдаёт | Задача |
|---|---|---|
| `GET /api/races` | Гонки (текущая и архив) | 2.3 |
| `GET /api/races/current` | Текущая гонка: статус, даты, дисциплины | 2.3 |
| `GET /api/races/{id}/participants` | Участники. Параметры: `discipline`, `q`, `sort` | 2.3 |
| `GET /api/participants/{id}` | Карточка участника, его гонки по годам | 2.3 |
| `GET /api/races/{id}/stages` | Этапы с датами и статусом | 2.4 |
| `GET /api/stages/{id}` | Этап: КП по порядку, км, трек, профиль высот | 2.4 |
| `GET /api/races/{id}/results` | Общий зачёт по дисциплинам: этапы, штрафы, итог, места | 2.5 |
| `GET /api/stages/{id}/protocols` | Протоколы этапа по дисциплинам (только опубликованные) | 2.5 |
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
