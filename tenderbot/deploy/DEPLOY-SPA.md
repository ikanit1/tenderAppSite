# Деплой SPA (tenderAppSite) и устранение 403/500

## Быстрый деплой

```bash
cd /opt/tenderAppSite-main
npm run build
sudo rm -rf /var/www/tenderAppSite/*
sudo cp -r dist/* /var/www/tenderAppSite/
sudo chown -R www-data:www-data /var/www/tenderAppSite
sudo nginx -t && sudo systemctl restart nginx
```

## Почему 403 Forbidden

В `dist` есть **каталог** `projects` (картинки из `public/projects`). При запросе `/projects` или `/projects/` nginx по умолчанию пытается отдать этот каталог. В каталоге нет `index.html`, листинг отключён → **403 Forbidden**.

**Решение:** в конфиге nginx для этого сайта должен быть блок:

```nginx
location /projects {
    rewrite ^/projects(/.*)?$ /index.html last;
}
```

Тогда маршрут SPA `/projects` отдаёт `index.html`, а не каталог.

## Почему 500 Internal Server Error

- Проверьте, **какой** server block обрабатывает запрос (домен или default). Если обрабатывает другой конфиг (например, default с `root /var/www/html`), то либо меняется root, либо срабатывает proxy/php и даёт 500.
- Убедитесь, что в конфиге указан `root /var/www/tenderAppSite` и нет опечаток в пути.
- Проверьте права: `sudo -u www-data cat /var/www/tenderAppSite/index.html` должен читаться.

## Какой конфиг использовать

| Сценарий | Конфиг |
|----------|--------|
| Один домен grgroup.kz (сайт + каталог + TenderBot) | `grgroup.kz.nginx.conf` → `sites-available/grgroup.kz.conf` |
| Только SPA по IP или отдельному домену | `tenderAppSite-only.conf` → `sites-available/tenderAppSite.conf` |

После копирования конфига:

```bash
sudo ln -sf /etc/nginx/sites-available/ИМЯ.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Проверка после деплоя

```bash
# Есть ли index.html и права
ls -la /var/www/tenderAppSite/index.html
sudo -u www-data cat /var/www/tenderAppSite/index.html > /dev/null && echo OK

# Какой конфиг слушает 80
sudo nginx -T 2>/dev/null | grep -A2 "listen 80"
```

Откройте в браузере: главную `/`, затем `/projects`. Оба должны отдавать SPA, без 403.
