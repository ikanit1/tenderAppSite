# Деплой на grgroup.kz (Docker Compose + Nginx)

Пошаговая инструкция по деплою всех сервисов на одном домене `grgroup.kz`.

## Архитектура

- `https://grgroup.kz/` → Root site (маркетинговый сайт)
- `https://grgroup.kz/catalog/` → APISite (каталог B2B)
- `https://grgroup.kz/miniapp/` → TenderBot Mini App
- `https://grgroup.kz/login`, `/dashboard`, `/tenders` и т.д. → TenderBot веб-админка

## Предварительные требования

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

Установить:
```
VITE_CATALOG_URL=https://grgroup.kz/catalog
VITE_PRODUCT_API_ORIGIN=https://grgroup.kz/catalog
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

```bash
# Создать директорию для root site
sudo mkdir -p /var/www/tenderAppSite

# Скопировать собранный dist
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
# Проверить строку: root /var/www/tenderAppSite/dist;

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
2. Проверить переменные окружения root site: `VITE_PRODUCT_API_ORIGIN=https://grgroup.kz/catalog`
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
