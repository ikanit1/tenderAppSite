# Деплой на grgroup.kz

Пошаговая инструкция по деплою всех сервисов на одном домене `grgroup.kz`. **Для выкладки на сервер рекомендуется Часть A (с Docker)**; Часть B — вариант без контейнеров.

- **Часть A: С Docker** — Docker Compose (PostgreSQL, TenderBot, APISite в контейнерах), Nginx на хосте.
- **Часть B: Без Docker** — Python-приложения (TenderBot, APISite) и Nginx на сервере, TenderBot на SQLite (PostgreSQL не нужен).

---

## Часть A: Деплой с Docker

## Архитектура (A)

- `https://grgroup.kz/` → Root site (маркетинговый сайт)
- `https://grgroup.kz/catalog/` → APISite (каталог B2B)
- `https://grgroup.kz/miniapp/` → TenderBot Mini App
- `https://grgroup.kz/login`, `/dashboard`, `/tenders` и т.д. → TenderBot веб-админка

### Предварительные требования (A)

- Ubuntu/Debian VPS с root доступом
- Docker и Docker Compose установлены
- Nginx установлен
- Домен `grgroup.kz` указывает на IP сервера (A-запись)
- Node.js и npm установлены (для сборки фронтендов)

## Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker (если не установлен)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose (если не установлен)
sudo apt install docker-compose-plugin -y

# Установка Nginx (если не установлен)
sudo apt install nginx -y

# Установка Node.js и npm (для сборки фронтендов)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Шаг 2: Клонирование и подготовка проекта

```bash
# Клонирование репозитория (или загрузка файлов)
cd /opt
sudo git clone <your-repo-url> tenderAppSite-main
# или
# sudo mkdir -p /opt/tenderAppSite-main
# sudo chown $USER:$USER /opt/tenderAppSite-main
# Загрузить файлы проекта в /opt/tenderAppSite-main

cd /opt/tenderAppSite-main
```

## Шаг 3: Настройка переменных окружения

### 3.1 Root Site

```bash
cd /opt/tenderAppSite-main
cp .env.example .env
nano .env
```

Установить (относительные пути — запросы на тот же хост, в интернете будет grgroup.kz, на VPS Nginx проксирует /catalog/ локально):
```
VITE_CATALOG_URL=/catalog
VITE_PRODUCT_API_ORIGIN=/catalog
```

### 3.2 TenderBot

```bash
cd /opt/tenderAppSite-main/tenderbot
cp envv.txt .env
nano .env
```

Установить (обязательно сменить секреты!):
```
BOT_TOKEN=your_bot_token_here
ADMIN_ID=your_telegram_id
DATABASE_URL=postgresql+asyncpg://tenderbot:your_password@db:5432/tenderbot
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_strong_password_here
WEB_SECRET_KEY=$(openssl rand -hex 32)
MINIAPP_BASE_URL=https://grgroup.kz
WEB_PORT=8000
WEB_HOST=0.0.0.0
```

### 3.3 APISite

```bash
cd /opt/tenderAppSite-main/tenderbot/apisite
cp .env.example .env
nano .env
```

Установить:
```
PORT=8001
HOST=0.0.0.0
UVICORN_WORKERS=2
CORS_ORIGINS=https://grgroup.kz
API_KEY=your_api_key_here
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_google_cse_id
IMAGE_PARSER_ENABLED=true
IMAGE_PARSER_MAX_PAGES=0
IMAGE_PARSER_STARTUP_DELAY=30
```

### 3.4 APISite React

```bash
cd /opt/tenderAppSite-main/tenderbot/apisite/react
cp .env.example .env
nano .env
```

Установить:
```
VITE_BASE_PATH=/catalog
VITE_MAIN_SITE_URL=https://grgroup.kz
VITE_BOT_URL=https://t.me/tenderlbot
```

## Шаг 4: Сборка фронтендов

### 4.1 Root Site

```bash
cd /opt/tenderAppSite-main
npm install
npm run build
```

Проверить, что создалась папка `dist/`:
```bash
ls -la dist/
```

### 4.2 APISite React

```bash
cd /opt/tenderAppSite-main/tenderbot/apisite/react
npm install
npm run build
```

Проверить, что создалась папка `dist/`:
```bash
ls -la dist/
```

## Шаг 5: Размещение Root Site

Файлы маркетингового сайта должны лежать в `/var/www/tenderAppSite/` (содержимое `dist/`). Nginx использует `root /var/www/tenderAppSite;`.

```bash
# Создать директорию для root site
sudo mkdir -p /var/www/tenderAppSite

# Скопировать содержимое dist в /var/www/tenderAppSite/
sudo cp -r /opt/tenderAppSite-main/dist/* /var/www/tenderAppSite/

# Установить права
sudo chown -R www-data:www-data /var/www/tenderAppSite
sudo chmod -R 755 /var/www/tenderAppSite
```

## Шаг 6: Настройка Nginx

```bash
# Копировать конфигурацию
sudo cp /opt/tenderAppSite-main/tenderbot/deploy/nginx-grgroup.kz.conf /etc/nginx/sites-available/grgroup.kz.conf

# Проверить конфигурацию (убедиться, что путь к root site правильный)
sudo nano /etc/nginx/sites-available/grgroup.kz.conf
# Должна быть строка: root /var/www/tenderAppSite; (без dist — содержимое dist копируется в эту папку)

# Активировать сайт
sudo ln -s /etc/nginx/sites-available/grgroup.kz.conf /etc/nginx/sites-enabled/

# Проверить конфигурацию Nginx
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

## Шаг 7: Настройка SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot --nginx -d grgroup.kz -d www.grgroup.kz

# Certbot автоматически обновит конфигурацию Nginx
# Проверить, что SSL работает
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 8: Запуск Docker Compose

```bash
cd /opt/tenderAppSite-main/tenderbot

# Сборка образов
docker compose build

# Запуск сервисов
docker compose up -d

# Проверка статуса
docker compose ps

# Просмотр логов
docker compose logs -f
```

## Шаг 9: Проверка работоспособности

1. **Root site**: Открыть `https://grgroup.kz/`
   - Должен открыться маркетинговый сайт
   - Проверить, что ссылка "Каталог" ведет на `/catalog/`

2. **Каталог**: Открыть `https://grgroup.kz/catalog/`
   - Должен открыться каталог B2B
   - Проверить, что товары загружаются
   - Проверить, что API запросы работают

3. **TenderBot веб-админка**: Открыть `https://grgroup.kz/login`
   - Должна открыться страница входа
   - Войти с учетными данными из `.env`

4. **API endpoints**: Проверить `https://grgroup.kz/catalog/api/health`
   - Должен вернуться статус 200

## Шаг 10: Автозапуск при перезагрузке

```bash
# Docker Compose автоматически перезапускается через restart: unless-stopped
# Для автозапуска Docker при загрузке системы:
sudo systemctl enable docker

# Для автозапуска Nginx при загрузке системы:
sudo systemctl enable nginx
```

---

## Часть B: Деплой без Docker (и без PostgreSQL)

Сервисы TenderBot и APISite работают напрямую на сервере. **БД для TenderBot — SQLite** (файл в каталоге проекта), PostgreSQL не используется. Root site раздаётся Nginx из `/var/www/tenderAppSite/`. Nginx проксирует `/catalog/` на APISite (порт 8001) и админку/Mini App на TenderBot (порт 8000).

### Требования (B)

- Ubuntu/Debian VPS
- Nginx, Node.js (для сборки), Python 3.10+
- Домен `grgroup.kz` → IP сервера

### B.1 Подготовка сервера (без Docker)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx python3.10-venv python3-pip

# Node.js для сборки фронтендов
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### B.2 База данных TenderBot: SQLite

PostgreSQL не нужен. В `tenderbot/.env` укажите SQLite (абсолютный путь — надёжнее при запуске из systemd):

```
DATABASE_URL=sqlite+aiosqlite:////opt/tenderAppSite-main/tenderbot/data.db
```

Либо относительный путь (файл создаётся в `WorkingDirectory` сервиса):
```
DATABASE_URL=sqlite+aiosqlite:///./data.db
```

Остальные переменные — как в разделе «Шаг 3: Настройка переменных окружения» (3.2, 3.3, 3.4).

### B.3 Клонирование, .env и сборка фронтов

Аналогично **Шагам 2–5** части A: клонировать в `/opt/tenderAppSite-main`, настроить все `.env` (корень, tenderbot, apisite, apisite/react), собрать root site и APISite React, скопировать содержимое `dist/` в `/var/www/tenderAppSite/`.

### B.4 Nginx и SSL

Как в **Шагах 6–7**: скопировать `nginx-grgroup.kz.conf`, включить сайт, получить сертификат Certbot для grgroup.kz и www.grgroup.kz.

### B.5 Виртуальные окружения Python

```bash
# TenderBot
cd /opt/tenderAppSite-main/tenderbot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Миграции (из корня репо или из tenderbot с PYTHONPATH)
cd /opt/tenderAppSite-main/tenderbot && source venv/bin/activate && alembic upgrade head

# APISite (отдельное venv из-за разных версий зависимостей)
cd /opt/tenderAppSite-main/tenderbot/apisite
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### B.6 Systemd: TenderBot и APISite

Создайте два юнита (или скопируйте готовые из репозитория: [tenderbot.service](tenderbot.service), [apisite.service](apisite.service)).

**`/etc/systemd/system/tenderbot.service`:**

```ini
[Unit]
Description=TenderBot (Telegram bot + Web admin)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/tenderAppSite-main/tenderbot
Environment="PATH=/opt/tenderAppSite-main/tenderbot/venv/bin"
ExecStart=/opt/tenderAppSite-main/tenderbot/venv/bin/python run.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/apisite.service`:**

```ini
[Unit]
Description=APISite (B2B catalog)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/tenderAppSite-main/tenderbot/apisite
Environment="PATH=/opt/tenderAppSite-main/tenderbot/apisite/venv/bin"
ExecStart=/opt/tenderAppSite-main/tenderbot/apisite/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Права на каталог проекта (чтобы `www-data` читал файлы и писал в `apisite/data`, `web/static/uploads` и т.д.):

```bash
sudo chown -R www-data:www-data /opt/tenderAppSite-main/tenderbot
```

Запуск и автозапуск:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tenderbot apisite
sudo systemctl start tenderbot apisite
sudo systemctl status tenderbot apisite
```

### B.7 Проверка

Как в **Шаге 9**: главная `https://grgroup.kz/`, каталог `https://grgroup.kz/catalog/`, админка `https://grgroup.kz/login`, API `https://grgroup.kz/catalog/api/health`.

### Обновление (без Docker)

```bash
cd /opt/tenderAppSite-main
git pull

# Root site
npm run build && sudo cp -r dist/* /var/www/tenderAppSite/

# APISite React
cd tenderbot/apisite/react && npm run build

# Перезапуск сервисов при изменении бэкенда
sudo systemctl restart tenderbot apisite
```

### Устранение неполадок (B)

- **TenderBot/APISite не стартуют:** `sudo journalctl -u tenderbot -n 50`, `sudo journalctl -u apisite -n 50`. Для TenderBot проверить `DATABASE_URL` (путь к `data.db`), права на каталог `tenderbot/` (www-data должен писать в него).
- **Каталог не открывается:** убедиться, что собран `tenderbot/apisite/react/dist/` и запущен `apisite.service`; логи: `journalctl -u apisite -f`.

---

## Обновление проекта

### Обновление кода

```bash
cd /opt/tenderAppSite-main
git pull  # или загрузить новые файлы
```

### Пересборка фронтендов

```bash
# Root site
cd /opt/tenderAppSite-main
npm run build
sudo cp -r dist/* /var/www/tenderAppSite/

# APISite React
cd /opt/tenderAppSite-main/tenderbot/apisite/react
npm run build
```

### Перезапуск Docker сервисов

```bash
cd /opt/tenderAppSite-main/tenderbot
docker compose down
docker compose build
docker compose up -d
```

## Мониторинг и логи

### Docker логи

```bash
cd /opt/tenderAppSite-main/tenderbot

# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f app
docker compose logs -f apisite
docker compose logs -f db
```

### Nginx логи

```bash
# Access log
sudo tail -f /var/log/nginx/access.log

# Error log
sudo tail -f /var/log/nginx/error.log
```

### Проверка статуса сервисов

```bash
# Docker сервисы
docker compose ps

# Nginx
sudo systemctl status nginx

# Проверка портов
sudo netstat -tlnp | grep -E '8000|8001|443|80'
```

## Устранение неполадок

### На сервере всё ломается — пошаговая диагностика

Выполняй по порядку на VPS (подставь свой путь, если не `/opt/tenderAppSite-main`).

**1. Что вообще слушает порты**

```bash
sudo ss -tlnp | grep -E ':80|:443|:8000|:8001'
# или: sudo netstat -tlnp | grep -E '8000|8001|443|80'
```

Ожидаемо: `:80` и `:443` — nginx; `:8000` — TenderBot; `:8001` — APISite. Если 8000/8001 пусто — бэкенды не запущены.

**2. Nginx**

```bash
sudo nginx -t
sudo systemctl status nginx
# Ошибки: sudo tail -50 /var/log/nginx/error.log
```

Если `nginx -t` падает — правь конфиг (часто опечатка в `root` или в `proxy_pass`).

**3. Файлы главного сайта**

```bash
sudo ls -la /var/www/tenderAppSite/
# Должны быть index.html и папка assets/
```

Если пусто — заново: `npm run build` в корне проекта и `sudo cp -r dist/* /var/www/tenderAppSite/`.

**4. Бэкенды (выбери свой вариант)**

- **С Docker:**  
  `cd /opt/tenderAppSite-main/tenderbot && docker compose ps`  
  Все сервисы (app, apisite) в статусе Up? Логи: `docker compose logs -f app`, `docker compose logs -f apisite`. Если контейнеры падают — смотри логи и `.env` (DATABASE_URL, порты).
- **Без Docker:**  
  `sudo systemctl status tenderbot apisite`  
  Оба active (running)? Логи: `sudo journalctl -u tenderbot -n 100 --no-pager`, `sudo journalctl -u apisite -n 100 --no-pager`. Частые причины: нет `.env`, неверный путь к `data.db` (SQLite), нет прав у `www-data` на каталог.

**5. Проверка с самого сервера (localhost)**

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/api/health
```

Должны быть 200. Если 000 — сервис не слушает или упал; смотри логи из п.4.

**6. Переменные окружения**

- В корне проекта: лучше использовать относительные пути `VITE_CATALOG_URL=/catalog` и `VITE_PRODUCT_API_ORIGIN=/catalog` — тогда запросы идут на тот же хост (в интернете grgroup.kz), а Nginx на VPS проксирует их локально. Пересобери фронт после смены: `npm run build`.
- В `tenderbot/apisite/.env`: `CORS_ORIGINS` должен содержать твой домен, например `https://grgroup.kz`.
- В `tenderbot/apisite/react/.env`: `VITE_BASE_PATH=/catalog`, `VITE_MAIN_SITE_URL` — твой домен. После смены — пересборка: `cd tenderbot/apisite/react && npm run build`.

**7. Права (без Docker)**

```bash
sudo chown -R www-data:www-data /opt/tenderAppSite-main/tenderbot
# TenderBot должен иметь право писать data.db и web/static/uploads
```

**8. Каталог открывается, но API/запросы падают**

Проверь в браузере (F12 → Network): на какой URL уходят запросы. Должны идти на `https://grgroup.kz/catalog/...`, а не на localhost. Если идут на localhost — пересобери root site с правильным `.env` (п.6) и залей заново в `/var/www/tenderAppSite/`.

После каждого исправления: перезапуск сервисов (Docker: `docker compose restart app apisite`; без Docker: `sudo systemctl restart tenderbot apisite`), при смене конфига Nginx — `sudo nginx -t && sudo systemctl reload nginx`.

---

### Проблема: Root site не открывается

1. Проверить, что `dist/` скопирован в `/var/www/tenderAppSite/`
2. Проверить права доступа: `sudo ls -la /var/www/tenderAppSite/`
3. Проверить конфигурацию Nginx: `sudo nginx -t`
4. Проверить логи Nginx: `sudo tail -f /var/log/nginx/error.log`

### Проблема: Каталог не открывается

1. Проверить, что APISite запущен: `docker compose ps`
2. Проверить логи APISite: `docker compose logs apisite`
3. Проверить, что React собран: `ls -la tenderbot/apisite/react/dist/`
4. Проверить переменную `VITE_BASE_PATH=/catalog` в `.env`

### Проблема: API запросы не работают

1. Проверить CORS настройки в `tenderbot/apisite/.env`: `CORS_ORIGINS=https://grgroup.kz`
2. Проверить переменные окружения root site: лучше `VITE_PRODUCT_API_ORIGIN=/catalog` (относительный путь)
3. Проверить логи APISite на ошибки CORS

### Проблема: SSL не работает

1. Проверить, что домен указывает на сервер: `dig grgroup.kz`
2. Проверить конфигурацию Nginx: `sudo nginx -t`
3. Проверить сертификат: `sudo certbot certificates`
4. Обновить сертификат: `sudo certbot renew --dry-run`

## Безопасность

1. **Обязательно смените все дефолтные пароли и секреты** в `.env` файлах
2. **Настройте firewall** (UFW):
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
3. **Регулярно обновляйте систему и зависимости**
4. **Настройте автоматическое обновление SSL сертификатов**:
   ```bash
   sudo systemctl enable certbot.timer
   ```

## Резервное копирование

Рекомендуется настроить регулярное резервное копирование:

1. База данных PostgreSQL (если используется)
2. Файлы `.env` с секретами
3. Собранные фронтенды (`dist/` папки)
4. Данные APISite (volumes)

## Дополнительные ресурсы

- [Docker Compose документация](https://docs.docker.com/compose/)
- [Nginx документация](https://nginx.org/en/docs/)
- [Let's Encrypt документация](https://letsencrypt.org/docs/)
