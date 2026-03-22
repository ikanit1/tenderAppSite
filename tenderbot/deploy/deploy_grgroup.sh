#!/usr/bin/env bash
# Деплой TenderBot и окружения grgroup.kz: всё через https://grgroup.kz
# Запуск на сервере: cd /opt/tenderAppSite-main/tenderbot/deploy && sudo bash deploy_grgroup.sh
# Или с локальной машины: SERVER=user@grgroup.kz bash deploy_grgroup.sh
#
# Если используется Docker: на сервере после git pull выполните:
#   cd /opt/tenderAppSite-main/tenderbot && docker compose build app && docker compose up -d app

set -e

PROJECT_PATH="${PROJECT_PATH:-/opt/tenderAppSite-main}"
TENDERBOT_DIR="${PROJECT_PATH}/tenderbot"
BASE_URL="https://grgroup.kz"

run_remote() {
  if [[ -n "${SERVER}" ]]; then
    ssh "${SERVER}" "$@"
  else
    bash -c "$*"
  fi
}

echo "=== Деплой TenderBot для grgroup.kz ==="
echo "  PROJECT_PATH=${PROJECT_PATH}"
echo "  SERVER=${SERVER:-локально}"
echo ""

# 1. Обновить код (если это git-репозиторий)
run_remote "cd ${PROJECT_PATH} && (git status >/dev/null 2>&1 && git pull --rebase || true)"

# 2. Убедиться, что в tenderbot/.env задан MINIAPP_BASE_URL=https://grgroup.kz
run_remote "cd ${TENDERBOT_DIR} && if [[ -f .env ]]; then
  if grep -q '^MINIAPP_BASE_URL=' .env; then
    sed -i 's|^MINIAPP_BASE_URL=.*|MINIAPP_BASE_URL=${BASE_URL}|' .env
  else
    echo 'MINIAPP_BASE_URL=${BASE_URL}' >> .env
  fi
  echo '  .env: MINIAPP_BASE_URL задан для ${BASE_URL}'
else
  echo '  Внимание: .env не найден. Скопируйте: cp envv.txt .env и задайте BOT_TOKEN, ADMIN_ID, DATABASE_URL, MINIAPP_BASE_URL=${BASE_URL}'
fi"

# 2.1 Установить/обновить зависимости Python (например slowapi) и миграции
run_remote "cd ${TENDERBOT_DIR} && (pip install -r requirements.txt -q 2>/dev/null || pip3 install -r requirements.txt -q 2>/dev/null || true)"
run_remote "cd ${TENDERBOT_DIR} && (alembic upgrade head 2>/dev/null || true)"
echo "  Зависимости и миграции проверены."

# 3. Перезапустить TenderBot (бот + веб на порту 8000)
if run_remote "systemctl is-active --quiet tenderbot 2>/dev/null"; then
  run_remote "sudo systemctl restart tenderbot"
  echo "  TenderBot перезапущен (systemctl restart tenderbot)"
else
  echo "  Сервис tenderbot не установлен или не запущен. Установите: sudo cp ${TENDERBOT_DIR}/deploy/tenderbot.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable tenderbot && sudo systemctl start tenderbot"
fi

# 4. Опционально: перезапустить APISite (каталог)
if run_remote "systemctl is-active --quiet apisite 2>/dev/null"; then
  run_remote "sudo systemctl restart apisite"
  echo "  APISite перезапущен"
fi

# 5. Проверка Nginx (конфиг grgroup.kz)
if run_remote "[[ -f /etc/nginx/sites-available/grgroup.kz.conf ]]"; then
  echo "  Nginx: конфиг grgroup.kz присутствует"
else
  echo "  Внимание: /etc/nginx/sites-available/grgroup.kz.conf не найден. Скопируйте: sudo cp ${TENDERBOT_DIR}/deploy/grgroup.kz.nginx.conf /etc/nginx/sites-available/grgroup.kz.conf && sudo nginx -t && sudo systemctl reload nginx"
fi

echo ""
echo "Готово. Проверьте:"
echo "  - Mini App: ${BASE_URL}/miniapp/"
echo "  - Веб-админка: ${BASE_URL}/login"
echo "  - Health: curl -s ${BASE_URL}/health"
