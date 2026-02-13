# Конфигурация портов apisite

## Обзор

**Порт 8001** (FastAPI) — основной сервер каталога:
- API endpoints (`/api/*`, `/products/*`)
- Собранный React frontend из `react/dist` (SPA fallback)
- Работает всегда при запуске `npm run dev:apisite` или `python main.py`

**Порт 3000** (Vite dev server) — только для разработки:
- Hot reload для фронтенда apisite/react
- Proxy на 8001 для API запросов (`/api`, `/products`, `/static`)
- Запускается отдельно: `npm run dev:apisite:react`
- **В production не используется** — FastAPI отдает собранный React из `react/dist`

## Режимы работы

### Dev режим (вариант 1): Только FastAPI (8001)

```bash
npm run dev:apisite
```

- FastAPI отдает собранный React из `react/dist`
- Нет hot reload — нужно пересобирать после изменений
- Один порт, проще для отладки

### Dev режим (вариант 2): FastAPI (8001) + Vite dev (3000)

```bash
# Терминал 1
npm run dev:apisite

# Терминал 2
npm run dev:apisite:react
```

- FastAPI на 8001 (API + fallback на собранный React)
- Vite dev на 3000 (hot reload, proxy на 8001)
- Два порта, но удобно для разработки фронтенда

### Production режим

```bash
npm run build:apisite  # сборка React
npm run start:apisite  # или через PM2/Docker
```

- Только FastAPI на 8001
- Отдает собранный React из `react/dist`
- Vite dev server не используется

## Автосборка React

FastAPI автоматически собирает React при первом запросе, если `react/dist` отсутствует (см. `_ensure_react_build_sync()` в `main.py`). Для production лучше собирать заранее.

## Конфигурация

- FastAPI порт: `tenderbot/apisite/config.py` → `PORT` (по умолчанию 8001)
- Vite dev порт: `tenderbot/apisite/react/vite.config.js` → `server.port` (по умолчанию 3000)
- Proxy: `tenderbot/apisite/react/vite.config.js` → `server.proxy` (на 8001)
