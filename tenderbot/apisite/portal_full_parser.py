"""
Парсер портала complex.com.kz/portal: страницы 1–116.
Каждая позиция сохраняется в свою папку: название, описание, все изображения.
Требуется авторизация (учётные данные из product_image_parser).
"""
import re
import json
import time
import logging
from pathlib import Path
from typing import List, Dict, Optional, Any
from urllib.parse import urljoin
from dataclasses import dataclass, asdict

import requests
from bs4 import BeautifulSoup

from product_image_parser import (
    session,
    login,
    BASE_URL,
    PORTAL_URL,
    normalize_image_url,
    extract_model_from_text,
    extract_model_from_url,
    download_image,
)
from config import SCRAPING_DELAY

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Директория для экспорта: portal_export/{папка_товара}/
EXPORT_DIR = Path(__file__).parent / "portal_export"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# Страницы каталога: 1..116
START_PAGE = 1
END_PAGE = 116


@dataclass
class CatalogEntry:
    """Запись о товаре со страницы каталога."""
    model: str
    name: str
    product_url: str
    thumb_url: Optional[str] = None


@dataclass
class ProductFull:
    """Полные данные товара со страницы карточки."""
    name: str
    description: str
    image_urls: List[str]


def sanitize_foldername(s: str, max_len: int = 120) -> str:
    """Имя папки без недопустимых символов (то же правило, что в API: model_to_foldername)."""
    from utils import model_to_foldername
    return model_to_foldername(s, max_len=max_len)


def get_product_entries_from_page(page: int) -> List[CatalogEntry]:
    """Парсит страницу каталога и возвращает список записей (модель, название, URL товара, превью)."""
    entries: List[CatalogEntry] = []
    url = f"{PORTAL_URL}?sort=p.sort_order&order=ASC&page={page}"
    try:
        resp = session.get(url, timeout=20)
        if resp.status_code != 200:
            return entries
        soup = BeautifulSoup(resp.content, "lxml")
        product_rows = soup.find_all(
            "tr", class_=lambda x: x and ("product-layout" in x or "product-grid" in x)
        )
        if not product_rows:
            table = soup.find("table", id=lambda x: x and "myTable" in str(x))
            if table:
                tbody = table.find("tbody", id="prods2") or table.find("tbody")
                if tbody:
                    product_rows = [
                        r for r in tbody.find_all("tr")
                        if r.find("img", src=re.compile(r"/image/cache/"))
                    ]
        if not product_rows:
            all_rows = soup.find_all("tr")
            product_rows = [r for r in all_rows if r.find("img", src=re.compile(r"/image/cache/"))]

        for row in product_rows:
            img = row.find("img", src=re.compile(r"/image/cache/"))
            src = (img.get("src") or img.get("data-src") or img.get("data-lazy-src")) if img else None
            thumb_url = normalize_image_url(src) if src else None
            if not thumb_url and src and src.startswith("/"):
                thumb_url = urljoin(BASE_URL, src)

            model_cell = row.find("td", class_=lambda x: x and "model" in str(x))
            link = None
            if model_cell:
                link = model_cell.find("a", href=re.compile(r"/product/|route=product/product", re.I))
            if not link:
                link = row.find("a", href=re.compile(r"/product/|route=product/product", re.I))

            if not link:
                continue

            product_url = link.get("href")
            if product_url and not product_url.startswith("http"):
                product_url = urljoin(BASE_URL, product_url)

            name = (link.get("value") or link.get_text(strip=True) or "").strip()
            name = re.sub(r"\s+", " ", name) if name else ""

            model = link.get("value") or extract_model_from_text(name) or extract_model_from_url(product_url or "")
            if not model and name:
                model = name
            if not model:
                continue

            entries.append(
                CatalogEntry(model=model.strip(), name=name or model, product_url=product_url or "", thumb_url=thumb_url)
            )
    except Exception as e:
        logger.error(f"Ошибка парсинга страницы {page}: {e}", exc_info=True)
    return entries


def parse_product_page_full(url: str) -> ProductFull:
    """Парсит страницу товара: название, описание, все изображения."""
    name = ""
    description = ""
    image_urls: List[str] = []
    try:
        resp = session.get(url, timeout=20)
        if resp.status_code != 200:
            return ProductFull(name=name, description=description, image_urls=image_urls)
        soup = BeautifulSoup(resp.content, "lxml")

        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(strip=True)

        desc_block = (
            soup.find("div", id="tab-description")
            or soup.find("div", id="description")
            or soup.find("div", class_=re.compile(r"tab-description|product-description", re.I))
        )
        if desc_block:
            description = desc_block.get_text(separator="\n", strip=True)

        for img in soup.find_all("img", src=re.compile(r"/image/cache/")):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if not src:
                continue
            orig = normalize_image_url(src)
            if orig and orig not in image_urls:
                image_urls.append(orig)
        if not image_urls:
            for img in soup.find_all("img", src=re.compile(r"/image/")):
                src = img.get("src") or img.get("data-src")
                if src:
                    u = urljoin(BASE_URL, src) if not src.startswith("http") else src
                    if u not in image_urls:
                        image_urls.append(u)
    except Exception as e:
        logger.error(f"Ошибка парсинга страницы товара {url}: {e}", exc_info=True)
    return ProductFull(name=name, description=description, image_urls=image_urls)


def ensure_unique_folder(base_path: Path) -> Path:
    """Если папка существует, добавляет суффикс _2, _3, ..."""
    p = base_path
    n = 1
    while p.exists():
        n += 1
        p = base_path.parent / f"{base_path.name}_{n}"
    return p


def save_product_to_folder(
    folder_name: str,
    catalog_entry: CatalogEntry,
    product: ProductFull,
    thumb_url: Optional[str],
) -> Path:
    """
    Создаёт папку товара, сохраняет name.txt, description.txt, info.json и скачивает изображения.
    Возвращает путь к папке.
    """
    safe_name = sanitize_foldername(folder_name)
    base = EXPORT_DIR / safe_name
    product_dir = ensure_unique_folder(base)
    product_dir.mkdir(parents=True, exist_ok=True)

    name_to_save = product.name or catalog_entry.name or catalog_entry.model
    (product_dir / "name.txt").write_text(name_to_save, encoding="utf-8")
    (product_dir / "description.txt").write_text(product.description or "", encoding="utf-8")

    all_images = list(product.image_urls)
    if thumb_url and thumb_url not in all_images:
        all_images.insert(0, thumb_url)

    info = {
        "model": catalog_entry.model,
        "name": name_to_save,
        "product_url": catalog_entry.product_url,
        "description_length": len(product.description),
        "images_count": len(all_images),
    }
    (product_dir / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")

    for i, img_url in enumerate(all_images, 1):
        ext = ".jpg"
        if ".png" in img_url.lower():
            ext = ".png"
        elif ".webp" in img_url.lower():
            ext = ".webp"
        fname = f"image_{i:02d}{ext}"
        save_path = product_dir / fname
        download_image(img_url, save_path, check_cache=False)
        time.sleep(SCRAPING_DELAY)

    return product_dir


def run_parser(start_page: int = START_PAGE, end_page: int = END_PAGE) -> None:
    """Парсит страницы start_page..end_page и сохраняет каждую позицию в свою папку."""
    logger.info("Инициализация сессии...")
    session.get(BASE_URL, timeout=20)
    if not login():
        logger.error("Авторизация не удалась. Проверьте учётные данные в product_image_parser.")
        return

    seen_urls: set = set()
    for page in range(start_page, end_page + 1):
        logger.info(f"Страница {page}/{end_page}")
        entries = get_product_entries_from_page(page)
        if not entries:
            logger.warning(f"Страница {page}: товары не найдены")
            time.sleep(SCRAPING_DELAY)
            continue

        for entry in entries:
            if entry.product_url and entry.product_url in seen_urls:
                continue
            if entry.product_url:
                seen_urls.add(entry.product_url)

            product = parse_product_page_full(entry.product_url) if entry.product_url else ProductFull(
                name=entry.name, description="", image_urls=[]
            )
            if not product.name:
                product = ProductFull(name=entry.name, description=product.description, image_urls=product.image_urls)
            if not product.image_urls and entry.thumb_url:
                product.image_urls.append(entry.thumb_url)

            folder_name = entry.model or entry.name or "product"
            save_product_to_folder(folder_name, entry, product, entry.thumb_url)
            time.sleep(SCRAPING_DELAY)

        time.sleep(SCRAPING_DELAY)

    logger.info(f"Экспорт завершён. Папки: {EXPORT_DIR.absolute()}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Парсер complex.com.kz/portal: страницы 1-116, каждая позиция в свою папку.")
    parser.add_argument("--start", type=int, default=START_PAGE, help=f"Начальная страница (по умолчанию {START_PAGE})")
    parser.add_argument("--end", type=int, default=END_PAGE, help=f"Конечная страница (по умолчанию {END_PAGE})")
    args = parser.parse_args()
    run_parser(args.start, args.end)
