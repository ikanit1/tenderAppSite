# Развёртывание на grgroup.kz

## Локальный тест через ngrok

**Важно для Mini App:** бесплатный ngrok показывает страницу «Visit Site». Из-за этого Telegram может загрузить не ваше приложение, а эту страницу, и initData не попадёт в приложение. Запускайте ngrok с добавлением заголовка, чтобы обойти предупреждение:

```bash
ngrok http 8000 --request-header-add "ngrok-skip-browser-warning: true"
```

В **.env** укажите выданный URL:

```env
MINIAPP_BASE_URL=https://xxxx.ngrok-free.app
```

(URL меняется при каждом новом запуске ngrok.) После этого открывайте приложение из бота (кнопка «Открыть приложение»).

---

## 1. DNS

- У домена **grgroup.kz** A-запись должна указывать на IP сервера, где запущен Nginx и приложение.

## 2. Переменные окружения

В `.env` на сервере задать:

```env
MINIAPP_BASE_URL=https://grgroup.kz
WEB_HOST=0.0.0.0
WEB_PORT=8000
```

Остальные переменные (BOT_TOKEN, DATABASE_URL, WEB_SECRET_KEY, ADMIN_PASSWORD и т.д.) — по необходимости.

## 3. Nginx

- Скопировать `deploy/nginx-grgroup.kz.conf` в `/etc/nginx/sites-available/grgroup.kz.conf`.
- Создать симлинк: `sudo ln -s /etc/nginx/sites-available/grgroup.kz.conf /etc/nginx/sites-enabled/`.
- Проверить конфиг: `sudo nginx -t`.
- Перезагрузить: `sudo systemctl reload nginx`.

## 4. SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d grgroup.kz
```

Certbot сам настроит HTTPS и редирект с HTTP на HTTPS.

## 5. Запуск приложения

Убедиться, что веб-сервер слушает на `0.0.0.0:8000` (или выбранный `WEB_PORT`), например:

```bash
python run_web.py
# или
uvicorn web.main:app --host 0.0.0.0 --port 8000
```

После этого:

- Админка: **https://grgroup.kz/**
- Mini App: **https://grgroup.kz/miniapp/**
