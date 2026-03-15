#!/usr/bin/env python3
"""
Скрипт загружает изображения из portal_export на соответствующие товары в SATU.

Товары в SATU должны уже существовать (загружены вручную по Excel). По артикулу (модели)
для каждой позиции отправляются фото из папки portal_export.

Запуск из папки apisite:
  python upload_satu_images.py
  python upload_satu_images.py --limit 50
"""
import sys
from pathlib import Path

_apisite_dir = Path(__file__).resolve().parent
if str(_apisite_dir) not in sys.path:
    sys.path.insert(0, str(_apisite_dir))

from config import SATU_API_TOKEN
from upload_to_satu import load_products_from_portal, upload_products_to_satu, satu_check_auth


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Загрузить изображения из portal_export на товары в SATU")
    parser.add_argument("--limit", type=int, default=None, help="Максимум товаров")
    args = parser.parse_args()

    if not SATU_API_TOKEN:
        print("Задайте SATU_API_TOKEN в .env или переменной окружения.")
        sys.exit(1)
    if not satu_check_auth(SATU_API_TOKEN):
        print("Токен SATU не прошёл проверку.")
        sys.exit(1)

    products = load_products_from_portal(limit=args.limit)
    if not products:
        print("Товары не найдены в portal_export.")
        sys.exit(1)

    ok, err = upload_products_to_satu(products, SATU_API_TOKEN, dry_run=False, images_only=False)
    print(f"Итого: успешно {ok}, ошибок {err}")


if __name__ == "__main__":
    main()
