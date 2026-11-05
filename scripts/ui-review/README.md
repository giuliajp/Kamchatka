# Повторение UI-проверки

Нужны зависимости frontend/admin-panel и установленный Google Chrome. Скрипты используют Playwright из frontend, браузерный DPR 1 и фикстуры HTTP; запросы сохранения в рабочий API не выполняются.

Запустить в отдельных терминалах из корня:

```sh
npm --prefix frontend run dev -- --port 5175
npm --prefix frontend run storybook
npm --prefix admin-panel run storybook
```

Затем последовательно (не одновременно с Vitest coverage или другими browser runners):

```sh
node scripts/ui-review/acceptance.cjs
node scripts/ui-review/matrix.cjs
node scripts/ui-review/final-probes.cjs
node scripts/ui-review/stress-audit.cjs
node scripts/ui-review/story-sweep.cjs frontend
node scripts/ui-review/story-sweep.cjs admin
python3 scripts/ui-review/build-report.py
```

Результаты пишутся в `output/ui-review/fixes/` (ignored, сохранены локально). `build-report.py` обновляет реестры и компактную сводку; он не определяет автоматически готовность по пикселям. Figma XML/реестры сохранены в `output/ui-review/`. Для повторного формирования сравнений нужны исходные браузерные снимки Figma, сохранённые локально в `fixes/`, и Pillow; путь шрифта в `make-comparisons.py` рассчитан на macOS.

`ready()` ждёт DOM приложения, включая экраны с модальной шторкой, и перезагружает документ между независимыми кадрами. Это сбрасывает масштаб текста, который иначе накопился бы при hash-навигации. Тайлы могут обновляться независимо. Ошибка ожидания загрузки внешнего изображения не трактуется как ошибка приложения — кадр повторяется с ожиданием DOM.

Сценарий матрицы проверяет 224 сочетания: 7 размеров × 2 темы × 2 размера текста × 8 экранов. Масштаб текста задаётся root rem и удвоенными font-size/line-height токенами VKUI, без увеличения картинок. Внутренняя прокрутка дат, таблиц и фотополос допустима. Не каждое пересечение bounding boxes является ошибкой: теги участника и маркеры намеренно накладываются.

После изменения кода выполнить `npm --prefix frontend run check` и `npm --prefix admin-panel run check` по очереди. Не запускать два coverage-процесса над одним приложением одновременно: они используют один каталог `coverage/`.
