# Google Lighthouse — аудит качества сайта

Инструмент [Lighthouse](https://developer.chrome.com/docs/lighthouse/) проверяет производительность, доступность, лучшие практики и SEO.

## Установка

Зависимость уже добавлена в проект. Установите зависимости:

```bash
npm install
```

Для запуска Lighthouse нужен Chrome или Chromium. На Linux-сервере без GUI установите, например: `chromium-browser` или укажите путь в переменной `CHROME_PATH`. В среде без Chrome аудит завершится с ошибкой запуска браузера — в таком случае запускайте `npm run lighthouse:audit` на своей машине с установленным Chrome.

## Запуск проверок

### Проверка продакшн-сайта (grgroup.kz)

Запускает Lighthouse для всех публичных страниц на https://grgroup.kz:

```bash
npm run lighthouse:audit
```

Проверяются страницы:
- /
- /services, /contacts, /projects
- /smart-systems, /digital-ecosystem, /work
- /catalog/

Отчёты сохраняются в каталог `lighthouse-reports/` в формате HTML.

### Проверка локального окружения

Требуются запущенные dev-серверы (основной сайт на порту 5173, каталог на 8001):

```bash
# В одном терминале
npm run dev

# В другом — каталог
npm run dev:apisite:react
# или apisite на 8001

# Запуск аудита
npm run lighthouse:local
```

### Открыть последний отчёт

```bash
npm run lighthouse:report
```

Откроется последний сгенерированный HTML-отчёт в браузере по умолчанию.

## Интерпретация результатов

- **Performance** — скорость загрузки, LCP, FID, CLS. Цель: > 90 на mobile и desktop.
- **Accessibility** — контраст, альт-тексты, семантика, ARIA. Цель: 100.
- **Best Practices** — HTTPS, консольные ошибки, устаревшие API. Цель: > 90.
- **SEO** — meta description, заголовки, мобильная версия. Цель: > 90.

В каждом отчёте есть список исправлений с приоритетом и ссылками на документацию.

## Применение рекомендаций

1. Откройте HTML-отчёт и пройдитесь по блокам «Passed» / «Opportunities» / «Diagnostics».
2. Критичные замечания (красные) исправляйте в первую очередь.
3. Типичные правки:
   - **Изображения**: добавлять `alt`, сжимать размер, использовать современные форматы (WebP).
   - **Шрифты**: подключать с `font-display: swap`, избегать неиспользуемых начертаний.
   - **Скрипты**: отложенная загрузка некритичного JS, уменьшение размера бандла.
   - **Meta**: уникальные `title` и `description` для каждой страницы (уже через react-helmet-async).
4. После правок перезапустите аудит и сравните баллы.

## Конфигурация

- Список URL и настройки CI: [`lighthouse.config.js`](../lighthouse.config.js).
- Скрипт пакетной проверки: [`scripts/lighthouse-audit.js`](../scripts/lighthouse-audit.js).

Переменные окружения (опционально):
- `BASE_URL` — базовый URL основного сайта (по умолчанию https://grgroup.kz или http://localhost:5173 при `--local`).
- `CATALOG_URL` — URL каталога (по умолчанию тот же хост или http://localhost:8001 при `--local`).
