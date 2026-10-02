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
| `GET /api/seasons/current` | Текущий сезон: год, статус, даты | 2.1 |
| `GET /api/race/status` | Режим «до гонки / идёт / завершена», дата старта | 2.9 |
| `GET /api/participants` | Список участников. Параметры: `q`, `discipline`, `sort` | 2.2 |
| `GET /api/participants/<id>` | Карточка участника | 2.2 |
| `GET /api/stages` | Этапы сезона | 2.3 |
| `GET /api/stages/<id>` | Этап: КП, километраж, профиль высот, трек | 2.3 |
| `GET /api/results` | Сводная таблица лидеров | 2.6 |
| `GET /api/stages/<id>/results` | Протокол этапа: время на КП, штрафы, остановки | 2.6 |
| `GET /api/positions` | Последние позиции всех участников с временем и флагом «неактуально» | 3.1 |
| `GET /api/participants/<id>/track` | История точек участника | 3.2 |
| `GET /api/program` | Программа. Параметр: `date` | 2.10 |
| `GET /api/locations` | Зрительские локации | 2.10 |
| `GET /api/faq` | Вопросы и ответы, контакты | 2.10 |

### Административная панель (только после входа)

| Метод и адрес | Что делает | Задача |
|---|---|---|
| `POST /api/admin/login` | Вход организатора | 3.3 |
| `POST /api/admin/checkpoint-marks` | Ручная отметка КП | 3.4 |
| `/api/admin/participants`, `/entries`, `/stages`, `/checkpoints` | Создание, изменение, удаление | 3.5 |
| `/api/admin/trackers` | Трекеры и их привязка к участникам | 3.5 |
| `GET /api/admin/trackers/status` | Мониторинг: последнее сообщение, SOS | 3.6 |
| `/api/admin/faq`, `/program`, `/locations` | Управление контентом | 3.7 |
| `PUT /api/admin/race/status` | Переключение режима гонки | 3.7 |
