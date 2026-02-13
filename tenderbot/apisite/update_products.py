"""Скрипт для обновления данных о товарах (для cron)"""
from b2b_client import B2BClient
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def main():
    """Обновляет данные о товарах"""
    client = B2BClient()
    data = client.update_products(use_cache=False)
    
    if data and data.get("products"):
        logger.info(f"Обновлено: {data.get('updated')}")
        logger.info(f"Товаров: {len(data.get('products', []))}")
        sys.exit(0)
    else:
        logger.error("Ошибка: не удалось получить данные")
        sys.exit(1)


if __name__ == "__main__":
    main()
