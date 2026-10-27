# Авача — мини-приложение

Цифровой хаб гонки «Авача» и зимнего фестиваля «Берингия» (Министерство туризма Камчатского края).

VK Mini App: live-трекинг гонки по ездовому спорту, карточки участников, результаты, программа фестиваля,
новости и раздел для гостей Камчатки. Подробности — в `docs/brief-summary.md`.

## Срок

Готовность — октябрь 2026 (до старта сезона 2027).

## Структура репозитория

```
kamchatka-avacha/
├── docs/            # бриф, список экранов, гайд по бренду (цвета, шрифты)
├── frontend/        # VK Mini App, React + TypeScript, VKUI
├── backend/         # API, интеграция с трекерами Iridium360, база данных
├── admin-panel/     # веб-панель для контент-менеджера и организаторов
└── design/          # брендбук проекта, ссылки на Figma, экспортированные ассеты бренда
```

## С чего начать

Актуальный срез реализации, оставшиеся задачи и план VKUI/Storybook/UI-kit —
в [карте проекта](docs/PROJECT_MAP.md) (проверено 15.10.2026).

1. Прочитайте `docs/brief-summary.md` — сжатая выжимка брифа заказчика.
2. Прочитайте `docs/screens.md` — список экранов приложения и админ-панели.
3. Загляните в `docs/brand/` и `design/brandbook/kamchatka-brandbook.pdf` — официальный брендбук
   проекта; исходные приблизительные токены сохранены в `docs/brand/theme.reference.ts`.
   Текущий UI-kit использует стандартную тему VKUI.
4. Каждая папка (`frontend/`, `backend/`, `admin-panel/`) — со своим README и инструкцией по запуску.

## UI-kit и Storybook

В `frontend` доступны рабочая витрина компонентов и Storybook. После `npm ci`:
`npm run dev` запускает демонстрационный экран карты, `npm run storybook` — каталог,
`npm run check` — проверки с обязательным покрытием 100% и обе сборки.
Инструкции и состав компонентов: [frontend README](frontend/README.md).
Результаты проверки: [UI_KIT_VALIDATION.md](docs/UI_KIT_VALIDATION.md).

## Документация бэкенда

| Файл | О чём |
|---|---|
| `docs/backend-plan.md` | План работ бэкенда по этапам заказчика: кто что делает, статусы |
| `docs/domain.md` | Предметная область: сущности, правила, схема связей |
| `docs/database.md` | Справочник таблиц базы данных |
| `docs/api.md` | Адреса API: готовые и запланированные, формат ответов |

## Технологии (по ТЗ заказчика)

| Слой | Технологии |
| Frontend | React + TypeScript, VKUI, VK Bridge, VK ID |
| Backend | Python, FastAPI (async), SQLAlchemy 2.0, PostgreSQL, Alembic, хостинг на территории РФ (152-ФЗ) |
| Трекинг | Iridium360 API (спутниковые трекеры) |
| Карты | VK Карты / Яндекс.Карты / OpenStreetMap, формат GPX |
| Дизайн | Figma, светлая и тёмная темы |

## Полезные ссылки заказчика

- Сайт фестиваля: https://visitkamchatka.ru/beringia/
- Сообщество ВК: https://vk.ru/avacha.race
- Telegram: t.me/sleddogrussia
- Платформа трекинга: https://www.iridium360.ru
- Брендбук проекта: `design/brandbook/kamchatka-brandbook.pdf`
