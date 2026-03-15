#!/usr/bin/env bash
#
# Запускать НА СЕРВЕРЕ. Создаёт один Python-скрипт со всеми ключами внутри для запуска парса SATU на вашем ПК.
# После запуска скачайте с сервера: tenderbot/apisite/run_satu_from_my_pc.py
# На ПК: скопируйте всю папку apisite (с export_satu_excel.py и остальными файлами), положите run_satu_from_my_pc.py в неё,
# выполните pip install -r requirements.txt, запустите: python run_satu_from_my_pc.py
# После использования УДАЛИТЕ run_satu_from_my_pc.py (в нём ключи).
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
OUT_PY="$SCRIPT_DIR/run_satu_from_my_pc.py"
OUT_SH="$SCRIPT_DIR/run_satu_from_my_pc.sh"
OUT_BAT="$SCRIPT_DIR/run_satu_from_my_pc.bat"

# Читаем .env, экранируем кавычки для подстановки в sh
get_var() {
    local name="$1"
    local default="${2:-}"
    if [[ -f .env ]]; then
        local v
        v=$(grep -E "^${name}=" .env 2>/dev/null | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//" | head -1)
        if [[ -n "$v" ]]; then
            echo "$v"
            return
        fi
    fi
    echo "$default"
}

API_KEY=$(get_var "API_KEY" "")
SITEMAP_BASE_URL=$(get_var "SITEMAP_BASE_URL" "https://grgroup.kz")
B2B_API_URL=$(get_var "B2B_API_URL" "")
B2B_API_BASE_URL=$(get_var "B2B_API_BASE_URL" "")

# Экранирование для вставки в одинарные кавычки в shell (замена ' на '\'')
escape_shell() {
    echo "$1" | sed "s/'/'\\\\''/g"
}

API_KEY_E=$(escape_shell "$API_KEY")
SITEMAP_E=$(escape_shell "$SITEMAP_BASE_URL")
B2B_URL_E=$(escape_shell "$B2B_API_URL")
B2B_BASE_E=$(escape_shell "$B2B_API_BASE_URL")

cat > "$OUT_SH" << SCRIPT
#!/usr/bin/env bash
# Скрипт с ключами для экспорта SATU. Запускайте на своём ПК из папки apisite.
# После использования УДАЛИТЕ этот файл (содержит ключи).

set -e
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "\$DIR"
export API_KEY='$API_KEY_E'
export SITEMAP_BASE_URL='$SITEMAP_E'
[[ -n '$B2B_URL_E' ]] && export B2B_API_URL='$B2B_URL_E'
[[ -n '$B2B_BASE_E' ]] && export B2B_API_BASE_URL='$B2B_BASE_E'
echo "Экспорт Excel для SATU..."
python export_satu_excel.py --image-via-api -o "\$DIR/satu_import_full.xlsx"
echo "Готово: \$DIR/satu_import_full.xlsx"
SCRIPT

# Windows .bat: используем set "VAR=value" и экранируем %
escape_bat() {
    echo "$1" | sed 's/%/%%/g'
}
API_KEY_BAT=$(escape_bat "$API_KEY")
SITEMAP_BAT=$(escape_bat "$SITEMAP_BASE_URL")

cat > "$OUT_BAT" << BSCRIPT
@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "API_KEY=$API_KEY_BAT"
set "SITEMAP_BASE_URL=$SITEMAP_BAT"
echo Экспорт Excel для SATU...
python export_satu_excel.py --image-via-api -o "%~dp0satu_import_full.xlsx"
if errorlevel 1 ( echo Ошибка. Установите зависимости: pip install -r requirements.txt & pause & exit /b 1 )
echo Готово: %~dp0satu_import_full.xlsx
pause
BSCRIPT

# Экранирование для Python: \ и ' в одинарных кавычках
escape_py() {
    echo "$1" | sed 's/\\/\\\\/g; s/'"'"'/\\'"'"'/g'
}
API_KEY_PY=$(escape_py "$API_KEY")
SITEMAP_PY=$(escape_py "$SITEMAP_BASE_URL")
EXIT_ONE=1

cat > "$OUT_PY" << PYSCRIPT
# -*- coding: utf-8 -*-
# Скрипт с ключами для экспорта Excel SATU. Запускайте на своём ПК из папки apisite.
# После использования УДАЛИТЕ этот файл (содержит ключи).
# Основа: export_satu_excel.py (парс B2B API + portal_export -> XLSX для SATU).

import os
import sys
from pathlib import Path

# Ключи (заданы при генерации на сервере)
API_KEY = '$API_KEY_PY'
SITEMAP_BASE_URL = '$SITEMAP_PY'

# Подставляем в окружение до импорта config/export_satu_excel
os.environ["API_KEY"] = API_KEY
os.environ["SITEMAP_BASE_URL"] = SITEMAP_BASE_URL.strip().rstrip("/") or "https://grgroup.kz"

# Скрипт должен лежать в папке apisite (рядом с export_satu_excel.py)
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
os.chdir(SCRIPT_DIR)

def main():
    from export_satu_excel import load_products_for_satu, build_full_excel
    out_path = SCRIPT_DIR / "satu_import_full.xlsx"
    print("Экспорт Excel для SATU (данные из B2B API + portal_export)...")
    products = load_products_for_satu(from_api=True, limit=None)
    if not products:
        print("Товары не найдены в API/кэше.")
        sys.exit($EXIT_ONE)
    api_base = os.environ.get("SITEMAP_BASE_URL", "").strip().rstrip("/") or None
    wb, count = build_full_excel(
        products,
        limit=None,
        image_via_api=True,
        api_base_url=api_base,
    )
    wb.save(out_path)
    print(f"Готово: {count} позиций сохранено в {out_path}")

if __name__ == "__main__":
    main()
PYSCRIPT

chmod +x "$OUT_SH"
echo "Создан Python-скрипт со всеми ключами внутри (скачайте и удалите после использования):"
echo "  $OUT_PY"
echo ""
echo "Также созданы (при необходимости): $OUT_SH  $OUT_BAT"
echo ""
echo "На вашем ПК:"
echo "  1. Скопируйте всю папку apisite с сервера (с export_satu_excel.py, requirements.txt и др.)."
echo "  2. Положите скачанный run_satu_from_my_pc.py в эту папку."
echo "  3. В папке apisite выполните: pip install -r requirements.txt"
echo "  4. Запустите: python run_satu_from_my_pc.py"
echo "  5. Файл satu_import_full.xlsx появится в той же папке. После этого УДАЛИТЕ run_satu_from_my_pc.py."
