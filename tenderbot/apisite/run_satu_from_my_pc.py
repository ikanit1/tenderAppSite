# -*- coding: utf-8 -*-
# Скрипт с ключами для экспорта Excel SATU. Запускайте на своём ПК из папки apisite.
# После использования УДАЛИТЕ этот файл (содержит ключи).
# Основа: export_satu_excel.py (парс B2B API + portal_export -> XLSX для SATU).

import os
import sys
from pathlib import Path

# Ключи (заданы при генерации на сервере)
API_KEY = ''
SITEMAP_BASE_URL = 'https://grgroup.kz'

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
        sys.exit(1)
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
