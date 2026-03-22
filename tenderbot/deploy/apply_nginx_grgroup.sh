#!/usr/bin/env bash
#
# Обновление nginx для grgroup.kz: копирование конфига и перезагрузка nginx.
# Запускать на сервере или с вашего ПК (через SSH).
#
# На сервере:
#   cd /opt/tenderAppSite-main/tenderbot/deploy && sudo bash apply_nginx_grgroup.sh
#
# С вашего компьютера (скрипт зайдёт по SSH и выполнит команды на сервере):
#   SERVER=user@grgroup.kz bash apply_nginx_grgroup.sh
#   или положите скрипт в репозиторий и:
#   SERVER=user@ваш-сервер ./apply_nginx_grgroup.sh
#
# Переменные (при необходимости задайте перед запуском):
#   SERVER          — если задано, команды выполняются на удалённом сервере (user@host)
#   PROJECT_PATH    — путь к проекту на (целевом) сервере; по умолчанию /opt/tenderAppSite-main
#   NGINX_SITE      — имя конфига в sites-available; по умолчанию grgroup.kz.conf
#

set -e

# Путь к репозиторию: где лежит этот скрипт → корень проекта
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_PATH="${PROJECT_PATH:-/opt/tenderAppSite-main}"
NGINX_SITE="${NGINX_SITE:-grgroup.kz.conf}"
SOURCE_CONF="${DEPLOY_DIR}/grgroup.kz.nginx.conf"
TARGET_CONF="/etc/nginx/sites-available/${NGINX_SITE}"

run_remote() {
    if [[ -z "$SERVER" ]]; then
        return 1
    fi
    ssh "$SERVER" "$@"
    return $?
}

run_cmd() {
    if [[ -n "$SERVER" ]]; then
        ssh "$SERVER" "$@"
    else
        "$@"
    fi
}

echo "=== Nginx grgroup.kz: применить конфиг и перезагрузить nginx ==="
if [[ -n "$SERVER" ]]; then
    echo "Режим: удалённый сервер $SERVER"
    echo "Путь к проекту на сервере: $PROJECT_PATH"
else
    echo "Режим: текущая машина (сервер)"
fi

# Проверка наличия конфига в репозитории
if [[ -n "$SERVER" ]]; then
    run_remote "test -f ${PROJECT_PATH}/tenderbot/deploy/grgroup.kz.nginx.conf" || {
        echo "Ошибка: на сервере не найден ${PROJECT_PATH}/tenderbot/deploy/grgroup.kz.nginx.conf"
        echo "Сначала обновите репозиторий на сервере (git pull)."
        exit 1
    }
else
    if [[ ! -f "$SOURCE_CONF" ]]; then
        echo "Ошибка: не найден конфиг $SOURCE_CONF"
        exit 1
    fi
fi

echo ""
echo "1. Копирование конфига в sites-available..."
if [[ -n "$SERVER" ]]; then
    run_remote "sudo cp ${PROJECT_PATH}/tenderbot/deploy/grgroup.kz.nginx.conf ${TARGET_CONF}"
else
    sudo cp "$SOURCE_CONF" "$TARGET_CONF"
fi

echo "2. Проверка конфигурации nginx..."
run_cmd sudo nginx -t

echo "3. Перезагрузка nginx..."
run_cmd sudo systemctl reload nginx

echo ""
echo "Готово. Конфиг применён, nginx перезагружен."
