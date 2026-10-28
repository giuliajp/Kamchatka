# Авача · UI-kit

Ревью и очистка 27.10.2026: [находки, изменения и журнал проверок](CLEANUP_REVIEW.md).

## Экран карты — 17.10.2026

Приложение теперь открывает интерактивную карту и все состояния раздела Figma.
Добавлены 16 историй «Экраны / Карта Авача». Данные демонстрационные;
API, VK и реальные push не подключены. [Устройство, запуск и проверки](../docs/MAP_SCREEN.md).
Проверено: 106 тестов, 33 рабочих модуля, покрытие 100/100/100/100 и обе сборки.

Ниже сохранено описание подготовленного UI-kit; прежняя стартовая витрина заменена картой.

Рабочий frontend-каркас и каталог на React 19, TypeScript, Vite 8, VKUI 8 и
Storybook 10. Точные версии закреплены в package-lock.json.
Это витрина компонентов; карта, первый сценарий, VK Bridge, авторизация,
API, реальные подписки и push пока не подключены.

Актуальный статус: [сверка Figma → компоненты → stories](../docs/UI_KIT_FIGMA_AUDIT.md).
[Открыть Storybook](http://127.0.0.1:6006/?path=/story/компоненты-из-vkui-panel-header--default).
189 stories, 42 страницы документации; 90 тестов, 29 рабочих файлов с покрытием 100/100/100/100.
Две группы повторяют колонки Figma; общей story «Все компоненты» больше нет.
Слева — VKUI, справа — авторские компоненты. Шрифты включены в аудит, но файлов нет;
лимит Figma MCP препятствует завершению полной сверки. Точное совпадение пока не заявлено.

## Запуск

Node.js 22.21.0 (.nvmrc), npm 10 или новее. Из каталога frontend:

```bash
npm ci
npm run dev
```

Демонстрационная карта: http://127.0.0.1:5173. В другом терминале:

```bash
npm run storybook
```

Каталог: http://127.0.0.1:6006. Начальные настройки: светлая тема, Android,
390 px. Доступны обе темы, Android/iOS/VK Web и ширины 360/390/768/1280 px.
Текст 100% / 200% увеличивает только текст в Canvas. Controls меняют props, Actions показывают события, Accessibility проверяет
доступность. Кнопка поддержки, поля и поиск интерактивны в stories.
Данные демонстрационные; backend, клиент VK и секреты не нужны.

## Команды

| Команда | Назначение |
| --- | --- |
| npm run dev | Сервер Vite |
| npm run build | Проверка типов и production-сборка в dist |
| npm run preview | Просмотр production-сборки |
| npm run storybook | Интерактивный каталог |
| npm run build-storybook | Статический каталог в storybook-static |
| npm run lint / npm run typecheck | ESLint / TypeScript |
| npm test / npm run test:watch | Однократный запуск / наблюдение |
| npm run test:coverage | Тесты с обязательным покрытием 100% |
| npm run check | Lint, типы, покрытие, обе сборки |

## Компоненты и контракты

Стандартные кнопки, поиск, селекторы и типографику импортируем непосредственно
из @vkontakte/vkui. Проектные композиции находятся в src/components:

| Компонент | Props и поведение | Раздел Storybook |
| --- | --- | --- |
| SupportButton | selected, loading?, disabled?, onToggle; loading блокирует действие | Компоненты из VKUI/Buttons/Болею за |
| TextField | label, value, onChange(value), description?, error?, disabled?; ошибка заменяет подсказку | Компоненты из VKUI/Дополнительные компоненты/TextField |
| InfoCard | title, children; article с доступным заголовком | Компоненты созданные в этом документе/Дополнительные компоненты/InfoCard |
| ParticipantCard | name, number, region, discipline, photoUrl?, variant?, supported, supportLoading?, supportDisabled?, onSupportToggle | Компоненты созданные в этом документе/Дополнительные компоненты/ParticipantCard |
| DataState | status: loading/empty/error; для error обязателен onRetry | Компоненты созданные в этом документе/Дополнительные компоненты/DataState |
| DataFreshness | offline?, stale?, hasCachedData?, lastUpdated?, onRetry | Компоненты созданные в этом документе/Дополнительные компоненты/DataFreshness |
| RaceStageSelect | value, options, onChange(value), disabled?; будущие этапы доступны; описание вторичным цветом VKUI | Компоненты из VKUI/Select |

История первой итерации: [Select — параметры, TDD и оставшиеся расхождения](../docs/SELECT_TRANSFER.md).
Состояние Panel Header: [рабочий статус](../docs/PANEL_HEADER_TRANSFER.md).

ParticipantCard.variant: card (по умолчанию) или row; от 768 px строка
становится горизонтальной. Отсутствующее или недоступное фото заменяется
иконкой VKUI. Изображение в story — локальная иллюстрация-заглушка.

DataFreshness: по умолчанию offline=false, stale=false, hasCachedData=true.
lastUpdated — готовая подпись времени с согласованным часовым поясом.
Состояние сети и свежесть координаты независимы. Компонент не вычисляет пороги,
результаты или статус участника по GPS и не создаёт настоящий кэш.
При свежих онлайн-данных предупреждение не рендерится.

## Темы и стили

Приложение и Storybook используют src/app/AppProviders.tsx: ConfigProvider,
AdaptivityProvider и AppRoot в режиме embedded. Тема задаётся appearance,
платформа — platform. Общие стили импортируются в этом же провайдере.

VKUI-элементы сохраняют стандартные токены. Авторские маркеры используют исходные
цвета и ассеты Figma; параметры статусов, маршрута и Event card перенесены из свойств.
Шрифты Figma пока недоступны;
типографика — его компоненты. Для мелких подписей используется color_text_primary,
для действий — штатный appearance="accent". Стандартные вторичные подписи новых
композиций используют color_text_secondary. Замечания по контрасту обеих тем
зафиксированы в UI_KIT_TRANSFER.md для отдельного визуального прохода.
Правило контраста в Accessibility не отключается.

Исходная приблизительная палитра перенесена в
[theme.reference.ts](../docs/brand/theme.reference.ts) как справочник вне рабочего
frontend. Gotham Pro не подключён. Решение описано в [DESIGN.md](../DESIGN.md).
Для брендизации нужны утверждённые цифровые цвета, типографика, шрифты, ассеты
и ссылки Figma. Новую тему подключать средствами VKUI через общий провайдер;
затем повторить проверки. Не переопределять внутренние классы VKUI по экранам.

## TDD и покрытие

Для каждого собственного рабочего модуля: тест → подтверждённый RED → минимальная
реализация → GREEN → рефакторинг → stories. RED-прогоны этого этапа выполнены до
создания провайдера, компонентов, приложения и точки входа.

Vitest, React Testing Library, user-event и jest-dom работают в jsdom.
Компоненты VKUI настоящие; эмулируются только отсутствующие браузерные API
matchMedia, ResizeObserver и scrollTo. Проверяем текст, роли, ввод, клавиатуру, состояния
и обработчики. Snapshot-тестов внутренней разметки нет.

V8 измеряет statements, branches, functions и lines: **100% для каждого файла**.
coverage.include включает весь src/**/*.{ts,tsx}, даже не импортированный тестами
код. App и main.tsx участвуют. Исключены stories, каталог src/stories с
демонстрациями и декларации .d.ts. Тесты и конфигурация находятся вне src.
Нельзя использовать coverage-ignore, снижать пороги или исключать рабочий код.

Отчёты: coverage/index.html, coverage/lcov.info и таблица в терминале.
Недостигнутый порог завершает test:coverage и check ошибкой. CSS не входит в
метрику V8 и проверяется в браузере.

Перед передачей: npm ci → npm run check; затем обе темы, ширины
360/390/768/1280 px, длинные строки, увеличение, клавиатура и Accessibility.
Актуальные результаты: [UI_KIT_FIGMA_AUDIT.md](../docs/UI_KIT_FIGMA_AUDIT.md).
Исходная проверка каркаса: [UI_KIT_VALIDATION.md](../docs/UI_KIT_VALIDATION.md).
