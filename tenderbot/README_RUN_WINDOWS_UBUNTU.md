# Запуск проекта: Windows Dev и Ubuntu VPS

Этот документ фиксирует рабочую схему:

- **из корня репозитория** можно запустить всё одной командой: `npm run dev:all` (см. README в корне);
- локально на Windows: `tenderbot` и `apisite` можно запускать и раздельно;
- на Ubuntu VPS: оба сервиса поднимаются через `docker compose`, наружу публикуются единым доменом через Nginx.

## 1) Windows Dev (раздельный запуск)

Рекомендуемые порты:

- `tenderbot web`: `8000`
- `apisite backend`: `8001`
- `apisite react dev`: `3000` (Vite)

### 1.1 Tenderbot (бот + web)

Из корня проекта:

```powershell
cd E:\tenderbot
python run.py
```

Это поднимет:

- Telegram-бот (polling)
- web-интерфейс TenderBot на `http://localhost:8000`

### 1.2 APISite backend

В отдельном терминале:

```powershell
cd E:\tenderbot\apisite
set PORT=8001
python main.py
```

API APISite будет доступен на `http://localhost:8001`.

### 1.3 APISite React (hot reload) — опционально

**Важно:** Порт 3000 нужен только для разработки фронтенда с hot reload. В production используется только порт 8001 (FastAPI отдает собранный React из `react/dist`).

В третьем терминале (если нужен hot reload):

```powershell
cd E:\tenderbot\apisite\react
npm install
npm run dev
```

Или из корня проекта:

```powershell
npm run dev:apisite:react
```

Фронтенд откроется на `http://localhost:3000`.

**Логика портов:**

- **Порт 8001** (FastAPI) — основной сервер каталога:
  - API endpoints (`/api/*`, `/products/*`)
  - Собранный React frontend из `react/dist` (SPA fallback)
  - Работает всегда при запуске `npm run dev:apisite`

- **Порт 3000** (Vite dev server) — только для разработки:
  - Hot reload для фронтенда apisite/react
  - Proxy на 8001 для API запросов (`/api`, `/products`, `/static`)
  - Запускается отдельно: `npm run dev:apisite:react` или `cd tenderbot/apisite/react && npm run dev`
  - **В production не используется** — FastAPI отдает собранный React из `react/dist`

**Варианты запуска:**

1. **Только FastAPI (8001)** — без hot reload, отдает собранный React:
   ```bash
   npm run dev:apisite
   ```

2. **FastAPI (8001) + Vite dev (3000)** — с hot reload для разработки:
   ```bash
   npm run dev:apisite        # терминал 1
   npm run dev:apisite:react # терминал 2
   ```

Примечание:

- в `apisite/react/vite.config.js` прокси настроен на `http://localhost:8001`;
- если прокси не используется, можно задать `VITE_API_ORIGIN=http://localhost:8001`.

## 2) Ubuntu VPS (docker compose + nginx)

Цель: один домен, два приложения.

- `tenderbot` -> `/`
- `apisite` -> `/catalog/`

### 2.1 Подготовка `.env`

В корне проекта на сервере (`/opt/tenderbot` или ваш путь) создайте/обновите `.env`:

```env
# Tenderbot
WEB_PORT=8000
POSTGRES_PASSWORD=your_strong_password

# APISite
APISITE_PORT=8001
APISITE_API_KEY=
APISITE_GOOGLE_API_KEY=
APISITE_GOOGLE_CSE_ID=
APISITE_IMAGE_PARSER_ENABLED=true
APISITE_IMAGE_PARSER_MAX_PAGES=0
APISITE_IMAGE_PARSER_STARTUP_DELAY=30
```

### 2.2 Запуск контейнеров

```bash
cd /opt/tenderbot
docker compose build
docker compose up -d
docker compose ps
```

Ожидаемые сервисы:

- `db`
- `app` (TenderBot)
- `apisite`

### 2.3 Nginx (единый домен)

Используйте конфиг:

- `deploy/nginx-grgroup.kz.conf`

В конфиге уже заложено:

- `location /` -> `127.0.0.1:8000`
- `location /catalog/` -> `127.0.0.1:8001`

Команды:

```bash
sudo cp deploy/nginx-grgroup.kz.conf /etc/nginx/sites-available/grgroup.kz.conf
sudo ln -s /etc/nginx/sites-available/grgroup.kz.conf /etc/nginx/sites-enabled/grgroup.kz.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 2.4 SSL (Let's Encrypt)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d grgroup.kz -d www.grgroup.kz
```

### 2.5 Проверка

Проверьте:

- `https://grgroup.kz/` -> TenderBot web
- `https://grgroup.kz/catalog/` -> APISite
- `https://grgroup.kz/catalog/products` -> APISite API

Если `catalog` открывается, но API не отвечает:

- проверьте `docker compose logs apisite`;
- убедитесь, что `APISITE_PORT=8001`;
- проверьте проксирование в `nginx-grgroup.kz.conf`.

## 3) VPS без Docker (PM2 + Nginx)

Для деплоя без Docker: PM2 + Nginx + статика.

### 3.1 Чеклист production

1. **Секреты** — в `tenderbot/.env`:
   - `WEB_SECRET_KEY` (генерация: `openssl rand -hex 32`)
   - `ADMIN_PASSWORD` (сложный пароль)
   - `MINIAPP_BASE_URL=https://api.mytender.kz`
   - `DATABASE_URL` — абсолютный путь для SQLite или PostgreSQL

2. **Сборка фронтендов** (из корня):
   ```bash
   npm run build:all
   ```

3. **PM2** (из корня):
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save && pm2 startup
   ```

4. **Nginx** — с root-сайтом: `deploy/nginx-mytender.kz.conf` (без root-сайта: `deploy/nginx-grgroup.kz.conf`)

5. **SSL**: `certbot --nginx -d mytender.kz`

### 3.2 Переменные для production

- Root site: `VITE_CATALOG_URL=https://mytender.kz/catalog`, `VITE_PRODUCT_API_ORIGIN=https://mytender.kz/catalog`
- apisite/react: `VITE_MAIN_SITE_URL=https://mytender.kz`

## 4) Полезные команды диагностики

```bash
docker compose logs -f app
docker compose logs -f apisite
docker compose restart app apisite
docker compose ps
```

PM2:

```bash
pm2 status
pm2 logs tenderbot
pm2 logs apisite
pm2 restart all
```

Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx -n 200 --no-pager
```

