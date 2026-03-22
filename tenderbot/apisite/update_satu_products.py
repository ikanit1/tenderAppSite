#!/usr/bin/env python3
"""
Скрипт обновляет уже созданные в SATU позиции: подтягивает из portal_export
название, описание, цену и фото для каждого товара (совпадение по артикулу / external_id).

Товары в SATU должны уже существовать. Скрипт не создаёт новые позиции, только редактирует.

Запуск из папки apisite:
  python update_satu_products.py              # обновить все позиции
  python update_satu_products.py --dry-run    # только показать, что будет сделано
  python update_satu_products.py --limit 100   # первые 100 товаров
"""
import logging
import sys
from pathlib import Path

_apisite_dir = Path(__file__).resolve().parent
if str(_apisite_dir) not in sys.path:
    sys.path.insert(0, str(_apisite_dir))

from config import SATU_API_TOKEN
from upload_to_satu import (
    load_products_from_portal,
    upload_products_to_satu,
    satu_check_auth,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Обновить в SATU название, описание, цену и фото из portal_export для уже созданных позиций"
    )
    parser.add_argument("--limit", type=int, default=None, help="Максимум товаров для обновления")
    parser.add_argument("--dry-run", action="store_true", help="Не отправлять запросы, только показать список")
    args = parser.parse_args()

    if not SATU_API_TOKEN:
        logger.error("Задайте SATU_API_TOKEN в .env или переменной окружения.")
        sys.exit(1)

    if not args.dry_run and not satu_check_auth(SATU_API_TOKEN):
        logger.error("Токен SATU не прошёл проверку.")
        sys.exit(1)

    products = load_products_from_portal(limit=args.limit)
    if not products:
        logger.error("Товары не найдены в portal_export.")
        sys.exit(1)

    logger.info("Товаров к обновлению: %s (по артикулу: название, описание, цена, фото)", len(products))
    if args.dry_run:
        for i, p in enumerate(products[:10], 1):
            logger.info(
                "  %s. %s | %s ₸ | фото: %s",
                i, p["name"], p["price_tenge"], len(p["image_paths"])
            )
        if len(products) > 10:
            logger.info("  ... и ещё %s", len(products) - 10)
        logger.info("Запустите без --dry-run для отправки обновлений.")
        return

    ok, err = upload_products_to_satu(products, SATU_API_TOKEN, dry_run=False, images_only=False)
    logger.info("Итого: обновлено %s, ошибок %s", ok, err)
    sys.exit(1 if err else 0)


if __name__ == "__main__":
    main()
