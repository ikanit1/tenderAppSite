# Деплой на grgroup.kz

Краткий план деплоя. Подробные шаги: [tenderbot/deploy/DEPLOY_GRGROUP.md](tenderbot/deploy/DEPLOY_GRGROUP.md).

**Основной вариант деплоя на сервер — с Docker** (Часть A в полной инструкции). Вариант без Docker (Часть B — Python на хосте, systemd, SQLite) — альтернатива.

## Архитектура

| URL | Сервис | Описание |
|-----|--------|----------|
| `https://grgroup.kz/` | Root site | Маркетинговый SPA (содержимое `dist/`), раздаётся Nginx |
| `https://grgroup.kz/catalog/` | APISite | Каталог B2B (порт 8001) |
| `https://grgroup.kz/miniapp/`, `/login`, `/dashboard`, `/tenders` и т.д. | TenderBot | Веб-админка и Mini App (порт 8000) |

**Путь root site на сервере:** файлы лежат в `/var/www/tenderAppSite/` (в эту директорию копируется содержимое `dist/`). В конфиге Nginx задаётся `root /var/www/tenderAppSite;` (без подпапки `dist`).

## Требования

- Ubuntu/Debian VPS, Nginx, Node.js (сборка фронтов), домен grgroup.kz → IP
- **С Docker:** Docker и Docker Compose
- **Без Docker:** Python 3.10+ (TenderBot на SQLite, PostgreSQL не нужен)

## Чеклист деплоя (с Docker)

1. **Подготовка сервера** — Docker, Nginx, Node.js ([tenderbot/deploy/DEPLOY_GRGROUP.md](tenderbot/deploy/DEPLOY_GRGROUP.md) Шаг 1).
2. **Клонирование** — проект в `/opt/tenderAppSite-main` (Шаг 2).
3. **Переменные окружения:**
   - Корень: [.env.example](.env.example) → `.env` (`VITE_CATALOG_URL=/catalog`, `VITE_PRODUCT_API_ORIGIN=/catalog` — относительные пути, тот же хост в интернете, на VPS Nginx проксирует локально).
   - TenderBot: [tenderbot/deploy/.env.production.example](tenderbot/deploy/.env.production.example) → `tenderbot/.env`.
   - APISite: [tenderbot/apisite/.env.example](tenderbot/apisite/.env.example) → `tenderbot/apisite/.env`.
   - APISite React: [tenderbot/apisite/react/.env.example](tenderbot/apisite/react/.env.example) → `tenderbot/apisite/react/.env` (`VITE_BASE_PATH=/catalog`, `VITE_MAIN_SITE_URL=/`).
4. **Сборка фронтендов:** корень `npm run build`, каталог `cd tenderbot/apisite/react && npm run build`.
5. **Размещение root site:** содержимое `dist/` → `/var/www/tenderAppSite/`, Nginx `root /var/www/tenderAppSite;`.
6. **Nginx:** [tenderbot/deploy/nginx-grgroup.kz.conf](tenderbot/deploy/nginx-grgroup.kz.conf), SSL (Certbot).
7. **Запуск:** `cd tenderbot && docker compose up -d`. (Альтернатива без Docker: [Часть B](tenderbot/deploy/DEPLOY_GRGROUP.md) — systemd, [tenderbot.service](tenderbot/deploy/tenderbot.service), [apisite.service](tenderbot/deploy/apisite.service).)
8. **Проверка:** главная, `/catalog/`, `/login`, `https://grgroup.kz/catalog/api/health`.

## Универсальный деплой (главный сайт)

Скопируй и выполни одной вставкой — обновит только маркетинговый сайт (grgroup.kz без /catalog). Подходит для постоянного использования после правок в корне проекта.

```bash
cd /opt/tenderAppSite-main && npm run build && sudo rm -rf /var/www/tenderAppSite/* && sudo cp -r dist/* /var/www/tenderAppSite/ && sudo chown -R www-data:www-data /var/www/tenderAppSite && sudo nginx -t && sudo systemctl restart nginx
```

Что делает: сборка → очистка папки сайта → копирование новой сборки → права www-data → проверка Nginx → перезапуск Nginx. После этого открывай сайт в инкогнито или с жёстким обновлением (Ctrl+Shift+R).

---

## Обновление (всё: сайт + каталог + Docker)

Если менял каталог (tenderbot/apisite/react) или бэкенд — полный цикл:

```bash
cd /opt/tenderAppSite-main
git pull
npm run build && sudo rm -rf /var/www/tenderAppSite/* && sudo cp -r dist/* /var/www/tenderAppSite/ && sudo chown -R www-data:www-data /var/www/tenderAppSite
cd tenderbot/apisite/react && npm run build
cd /opt/tenderAppSite-main/tenderbot && docker compose down && docker compose build && docker compose up -d
sudo nginx -t && sudo systemctl restart nginx
```
(Без Docker: `sudo systemctl restart tenderbot apisite`.)

### Проверка после деплоя

- Копирование `dist/*` должно выполняться **на том же сервере**, где работает Nginx (если сборка на другой машине — скопировать `dist/*` на сервер через `rsync` или `scp`).
- На сервере проверить совпадение имён скриптов и файлов:
  ```bash
  grep -o 'index-[^"]*\.js' /var/www/tenderAppSite/index.html
  ls /var/www/tenderAppSite/assets/
  ```
  Имена JS в HTML должны совпадать с файлами в `assets/`.
- При необходимости: `sudo chown -R www-data:www-data /var/www/tenderAppSite`, `sudo nginx -s reload`.
- Открыть главную и `/calculator` в режиме инкогнито или с «Жёстким обновлением» (Empty Cache and Hard Reload), чтобы не видеть старую версию из кэша.

Корневой сайт собирается из шаблона `index.html` с точкой входа `<script type="module" src="/src/main.tsx"></script>`; в репозитории не должны быть захардкожены имена ассетов (Vite подставляет их при сборке).

---

Полная инструкция (с Docker и без): [tenderbot/deploy/DEPLOY_GRGROUP.md](tenderbot/deploy/DEPLOY_GRGROUP.md).
