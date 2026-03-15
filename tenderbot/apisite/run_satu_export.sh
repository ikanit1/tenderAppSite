#!/usr/bin/env bash
#
# Запуск экспорта Excel для SATU (парсинг B2B API + portal_export → XLSX).
# Работает на сервере и на вашем компьютере.
#
# На сервере:
#   cd /opt/tenderAppSite-main/tenderbot/apisite && bash run_satu_export.sh
#
# На вашем ПК:
#   1. Клонируйте репозиторий (или скопируйте папку tenderbot/apisite).
#   2. В папке apisite создайте .env (скопируйте с сервера или задайте):
#      API_KEY=ваш_ключ_b2b
#      SITEMAP_BASE_URL=https://grgroup.kz
#   3. Установите зависимости: pip install -r requirements.txt
#   4. Запустите: bash run_satu_export.sh
#
# Файл будет сохранён в эту же папку: apisite/satu_import_full.xlsx
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Опционально: виртуальное окружение рядом или в родителе
if [[ -d "$SCRIPT_DIR/venv" ]]; then
    source "$SCRIPT_DIR/venv/bin/activate"
elif [[ -d "$SCRIPT_DIR/../venv" ]]; then
    source "$SCRIPT_DIR/../venv/bin/activate"
fi

OUTPUT="${1:-satu_import_full.xlsx}"
if [[ "$OUTPUT" != /* ]]; then
    OUTPUT="$SCRIPT_DIR/$OUTPUT"
fi

echo "Экспорт Excel для SATU (данные из B2B API + portal_export)..."
python export_satu_excel.py --image-via-api -o "$OUTPUT"

echo ""
echo "Файл сохранён: $OUTPUT"
