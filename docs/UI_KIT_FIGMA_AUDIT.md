# UI-kit: структура Figma и аудит соответствия — 16.10.2026

## Текущий результат

Storybook разделён на две группы в порядке колонок Figma: «Компоненты из VKUI» и
«Компоненты созданные в этом документе». Общая story «Все компоненты» удалена.
Каждый компонент и каждая иконка доступны отдельно, варианты — отдельные stories.
Смешанные Search/Select, Dropdown, IconButton, КП, старт/финиш и кластер разделены.
Дополнительные композиции приложения и отсутствующие в макете состояния обозначены отдельно.

**Полное визуальное соответствие НЕ достигнуто.** Подключение Figma MCP заработало,
получены структура всего UI-kit, 14 подробных контекстов и исходные ассеты; затем
сервер сообщил о лимите запросов Starter. Это уже не ошибка подключения Unknown tool.
Оставшиеся свойства нельзя считать прочитанными по одной общей картинке.

Источник: [UI-kit, страница «Для разработки»](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7869).
[Общий эталон](figma-references/ui-kit.png). Эталоны отдельных узлов находятся в
`docs/figma-references/`; это материалы для сравнения, не изображения компонентов в коде.

## Шрифты и принятые решения

Пользователь уточнил: слева — основа VKUI, справа — авторские компоненты.
VKUI 8.4.2 и @vkontakte/icons 3.76.0 сохраняются. Авторские элементы используют
Tappable, Text, Caption и IconButton VKUI с измеренными стилями и исходными ассетами.
Слева сохранены штатные компоненты; Banner получает подтверждённое изображение 72 px.

Gotham Pro Regular/Medium/Bold подтверждён в шапке, Banner, статусах, маркерах,
КП, маршруте, деталях участника и Event card. В счётчике маршрута указан Roboto Regular.
VK Sans Display ранее отмечался Figma как отсутствующий шрифт файла; его привязка к
конкретному рабочему компоненту пока не подтверждена.

В проекте, `/Library/Fonts` и `~/Library/Fonts` нужных Gotham Pro / VK Sans Display нет;
пользователь подтвердил отсутствие файлов. Новое семейство взамен не выбиралось:
пока остаётся существующий системный шрифт VKUI. Для точного совпадения нужны файлы
подтверждённых начертаний, разрешённые к использованию в web. Это препятствие приёмке,
а не выполненная часть переноса. Не следует выдавать fallback за Gotham Pro.

## Таблица соответствия

«Совпадает» применяется только к действительно проверенному параметру.
«Расхождение» — установлено конкретное отличие; «Не проверено» — свойств или проверки
недостаточно. Ни один полный компонент пока не помечен как полностью совпадающий.
В stories добавлены `parameters.figma` и теги `figma-mismatch` / `figma-unverified`.

| Узел Figma | Компонент / отдельная story | Статус | Основание |
| --- | --- | --- | --- |
| [339:7874](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7874) | [RacePanelHeader](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-panel-header--default) | Расхождение | 360 × 56. Gotham Pro Medium 16/20, tracking 0.1. В VKUI остаются отличия правой капсулы и типографики. |
| [339:7875](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7875) | [RaceStageSelect](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-select--select) | Расхождение | 328 × 44. Данные Figma получены; Gotham Pro не установлен. Варианты меню сверены не полностью. |
| [339:7880](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7880) | [StageListItem](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-list-item--completed) | Расхождение | 328 × 48, отступы 12/16. Шрифт Gotham Pro отсутствует; остальные состояния 339:7879, 339:7878 доступны только в общей структуре. |
| [339:7877](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7877) | [DropdownMenu](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-dropdown-menu--stages) | Расхождение | Меню этапов 328 × 392; дисциплин 339:7919 — 171 × 172. Используется настоящее меню VKUI; точная типографика не совпадает. |
| [339:7873](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7873) | [RaceTabs](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-tabs--discipline-options) | Не проверено | 360 × 48. Есть пять вариантов Figma, подробные свойства ограничены лимитом MCP. |
| [339:7916](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7916) | [TabDropdown](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-tab-dropdown--open) | Расхождение | 171 × 214, кнопка 171 × 34 и меню 171 × 172 с зазором 8. Текущая композиция VKUI требует отдельной сверки. |
| [339:7951](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7951) | [ParticipantBanner](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-banner--default) | Расхождение | 328 × 96, изображение 72, отступы/зазор 12. Настоящий VKUI Banner; исходное фото локально в story. Шрифты и типографика отличаются. |
| [339:7954](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7954) | [Button](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-buttons--primary) | Не проверено | Группа кнопок 296 × 44. Подробные свойства не получены из-за лимита MCP. |
| [339:7950](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7950) | [SupportButton](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-buttons-%D0%B1%D0%BE%D0%BB%D0%B5%D1%8E-%D0%B7%D0%B0--default) | Расхождение | Группа Болею за / Поделиться — 327 × 44. Исходные иконки получены; оформление ещё штатное VKUI. |
| [339:7955](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7955) | [IconButton](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-iconbutton--refresh) | Не проверено | Кнопки 44 × 44; также 339:7956 и 339:7922. Детальные свойства недоступны. |
| [339:7952](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7952) | [NotificationPreferences](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-%D0%B4%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5-%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-notificationpreferences--default) | Не проверено | Строки переключателей 296 × 54; второй узел 339:7953. Пока существующая композиция двух каналов. |
| [352:7182](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=352-7182) | [TextAction](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D0%B8%D0%B7-vkui-%D1%82%D0%B5%D0%BA%D1%81%D1%82%D0%BE%D0%B2%D1%8B%D0%B5-%D0%B4%D0%B5%D0%B9%D1%81%D1%82%D0%B2%D0%B8%D1%8F--photos) | Расхождение | 15 фото — 94 × 28, иконка add_16; Свернуть 352:7955 — 101 × 28. Шрифт отсутствует, второй узел не прочитан подробно. |
| [105:1414](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=105-1414) | [RaceTabbar](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-tabbar--map) | Не проверено | Tab Bar 360 × 72; подробные свойства недоступны из-за лимита MCP. |
| [104:1334](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=104-1334) | [TabbarItem](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-tab-bar-item--map-inactive) | Не проверено | 10 вариантов: 5 разделов × Active/Inactive; размер каждого 72 × 48. Иконки пока из рабочего кода. |
| [108:8575](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=108-8575) | [RaceHeader](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-header-panel--default) | Не проверено | Составная Panel Header 360 × 180; подробные свойства не прочитаны. |
| [317:14413](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=317-14413) | [TopParticipantsCard](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-top-3-card--top-3) | Не проверено | Default 122:9052 — 211 × 104; alternative 317:14414 — 280 × 104. Точные свойства недоступны. |
| [317:14429](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=317-14429) | [Position](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-position--current) | Не проверено | Две строки: 119:8983 — 150 × 18, 317:14435 — 260 × 18. В каталоге временно существующая функциональная композиция; это НЕ точная строка Figma. |
| [122:9315](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=122-9315) | [TimeBadge](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-time-badge--fresh) | Расхождение | 5 вариантов. Восстановлены исходные иконки, отступы, тени и повтор при offline. Gotham Pro Medium 14/18 отсутствует, поэтому ширина текста не совпадает. |
| [276:5012](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=276-5012) | [RaceMapMarker](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-map-points--confirmed) | Расхождение | 13 вариантов Figma, включая кластер. Размеры 44/36/28, контуры и значки экспортированы локально. Gotham Pro отсутствует. Комбинации лидер + stale отсутствуют в макете и отмечены дополнительными. |
| [280:5610](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=280-5610) | [Checkpoint](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-%D0%BA%D0%BF--first) | Расхождение | КП-1 38 × 24, КП-2 41 × 24. Отступы 4, радиус 12, border 1. Шрифт Gotham Pro Regular 12/14 отсутствует. |
| [317:17537](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=317-17537) | [StartFinish](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-start-finish-point--start) | Не проверено | Старт 64 × 24, финиш 74 × 24. Пока стандартные Button, точные свойства и ассет флага недоступны. |
| [278:5118](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=278-5118) | [ParticipantCluster](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-participant-cluster--four) | Расхождение | Контур +4 размером 28 × 28 выгружен из Map points. Число динамическое; Gotham Pro не установлен. |
| [339:7923](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7923) | [MapLegend](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-legend--confirmed) | Не проверено | Каждая строка легенды отдельно. Состав прочитан, точные параметры строк не получены. |
| [339:7885](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7885) | [ParticipantSheet](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-participant-bottom-sheet--open) | Не проверено | В Figma это заголовок зоны Participant bottom sheet, не готовый контейнер. Существующая ModalPage — дополнительная рабочая композиция, точное соответствие не заявлено. |
| [167:2831](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=167-2831) | [ParticipantGap](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-participant-bottom-sheet-participant-details--default) | Расхождение | Отставание: 104 × 62, фон #F6F7FB, radius 8, padding 12, gap 2. Gotham Pro Regular/Bold 14/18 отсутствует. |
| [317:17901](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=317-17901) | [ParticipantPlace](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-participant-bottom-sheet-participant-position--default) | Не проверено | Место участника 81 × 32; подробные свойства недоступны, пока Counter VKUI. |
| [173:2856](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=173-2856) | [RoutePoint](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-participant-bottom-sheet-route-point--passed) | Расхождение | 328 × 34, счётчик 24, gap 12, две строки. Параметры перенесены; Gotham Pro и Roboto не подключены локально. |
| [317:18332](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=317-18332) | [NotificationPrompt](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-modal-card--open) | Не проверено | Modal Card 328 × 298. Подробные свойства недоступны, используется настоящая ModalCard VKUI. |
| [352:8418](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=352-8418) | [EventCard](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-event-card--live) | Расхождение | 328 × 186, правая колонка 256, изображение 232 × 88 с исходным crop. Исходные фото/иконка локальны; Gotham Pro отсутствует. |
| [339:7898](https://www.figma.com/design/leyJ5DGOJdTNJlQHtgJTnJ/?node-id=339-7898) | [Icons](http://127.0.0.1:6006/?path=/story/%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%BD%D0%B5%D0%BD%D1%82%D1%8B-%D1%81%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5-%D0%B2-%D1%8D%D1%82%D0%BE%D0%BC-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B5-icons-%D0%B8%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D1%83%D0%B5%D0%BC%D1%8B%D0%B5-vkui--size-16-add) | Расхождение | Иконки рабочего кода показаны по одной. Состав Figma прочитан из метаданных: часть размеров/вариантов отличается; полная сверка ассетов не завершена. |

Точное соответствие порядка внутри неизвестных наборов и всех вариантов не заявлено:
для `position`, Modal card, Header Panel, Tabbar, start_finish_point и части кнопок
получена только общая структура. `Participant bottom sheet` в макете обозначает область
с отдельными элементами; существующий ParticipantSheet — рабочая композиция приложения.

## Исправления и проверенные параметры

- Map points: локальные исходные кольца, пунктир, корона, часы и альтернативный значок;
  размеры обычного/поддерживаемого участника 36/44 px. Кластер +4 — 28 px.
- Time badge: исходные иконки и тени, высота одиночного статуса 32 px. Offline имеет
  самостоятельную кнопку повтора, размер 328 × 60. Состояния offline/stale независимы.
- participant details: отдельный ParticipantGap, размер 104 × 62.
- route point: отдельная story, счётчик 24, зазор 12, размер 328 × 34.
- Event card: размер 328 × 186, колонка 256, слот фото 232 × 88; фото и иконка категории
  из исходного макета. Точный crop и типографика требуют окончательной визуальной приёмки.
- КП: рамка 1, радиус 12, высота 24. Ширина на текущем шрифте 38.96/40.63 вместо 38/41.
- Ширины Time badge на текущем шрифте: fresh 242.36 вместо 252; stale 241.43 вместо 251;
  position 192.04 вместо 199; unavailable 220.26 вместо 230. Эти отличия не скрываются.
- Шапка, Tabs и Tabbar показываются в собственной области 360 px без внешнего padding;
  Banner, List item и Select — в области 328 px. Длинные строки — отдельные проверки.

31 файл ассетов находится в `frontend/public/figma/`, все локальные и непустые.
SVG используются в исходных размерах, их пути не перерисованы. Временных URL Figma
в коде нет; работа Storybook не зависит от backend, VK-клиента или запросов к Figma.
`photoUrl` остаётся управляемым prop: исходные фото задаются демонстрационными данными.

## API и TDD

Существующие контракты сохранены. Добавлены:

- `TimeBadge.onRetry?` — только offline показывает кнопку «Обновить данные»;
- `RaceMapMarker.staleVariant?: 'clock' | 'live'` — оба варианта из Figma;
- `EventCard.categoryIconUrl?` — управляемый декоративный значок категории;
- `Checkpoint({ label, onSelect })`, `ParticipantCluster({ count, onSelect })`,
  `ParticipantGap({ gap })` — отдельные проектные компоненты.

Для новых компонентов и добавленного поведения подтверждены RED и GREEN:
`/tmp/avacha-{checkpoint,gap,cluster}-{red,green}.log`,
`/tmp/avacha-{time,marker,event}-figma-{red,green}.log`,
`/tmp/avacha-marker-priority-{red,green}.log` (приоритет часов, два варианта поддержки).
Проверяются текст, доступные названия, клавиатура, вызовы действий и выбор исходных
графических вариантов. Геометрия CSS проверяется браузером. VKUI не подменяется.

Финальная команда: `npm run check`; лог `/tmp/avacha-figma-final-check.log`.
90 тестов в 27 файлах; 29 рабочих файлов, каждый 100% statements/branches/functions/lines.
Coverage include/exclude и пороги не менялись; новые компоненты включены.
Lint, typecheck, coverage и обе сборки обязательны. Зависимости/lockfile не менялись;
чистая установка этого lockfile проверена на предыдущем этапе.

## Браузерная проверка и ограничения

Проверены отдельные stories: 17 вариантов авторских компонентов при 360 px в обеих
темах, а также Event card на 360/390/768/1280 в обеих темах. Дополнительно проверены Panel header 360 × 56, Banner 328 × 96 с фото 72 × 72
и выбор будущего этапа в Select. Исходные изображения
загружены; горизонтального переполнения в этих случаях нет. Повтор offline доступен
клавиатурой. Unit-тесты дополнительно проверяют действия и фокус.

В Storybook добавлен переключатель **Текст 100% / 200%** для Canvas. Он увеличивает
шрифты и line-height, включая токены VKUI; размеры изображений остаются прежними.
При 200% и 360 px проверены offline, длинная Event card, маршрут, отставание и маркер:
текст увеличивается 14→28, 13→26, 12→24 px, горизонтального переполнения нет.
Это проверка текущего fallback, после подключения исходных шрифтов её нужно повторить.

Accessibility: у отдельного поддерживаемого маркера 0 violations, 14 passes,
1 inconclusive (контраст с изображением требует ручной проверки); у Event card в
тёмной теме 1 color-contrast violation, 9 passes, 1 inconclusive.
Авторские цвета не менялись ради зелёного отчёта. Полная проверка контраста не завершена.
Тёмные варианты всех авторских компонентов не были прочитаны из Figma: переключение
темы работает, но точное совпадение тёмной темы не подтверждено.

Дополнительные сочетания лидер + stale не представлены в Figma. По решению пользователя
на маркере отображаются часы, корона скрыта; лидерство сохранено в доступном описании.
Проверены обычный и поддерживаемый участники. Это согласованное поведение, а не эталон
из макета. Для остальных непрочитанных узлов требуется доступный
лимит MCP либо экспорт свойств и ассетов. Оплата/смена тарифа не выполнялись.
