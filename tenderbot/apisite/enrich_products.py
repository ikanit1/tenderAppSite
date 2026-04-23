"""Обогащение product.json данными из complex.com.kz.

Парсит JSON-LD со страницы товара, извлекает описание, характеристики и бренд.
Сохраняет в portal_export/{model}/product.json с флагом "enriched": true.

Использование:
    python enrich_products.py              # обогатить все пустые товары
    python enrich_products.py --dry-run    # только посчитать цели
    python enrich_products.py --limit 10   # обработать первые 10
    python enrich_products.py --force      # перепарсить даже обогащённые
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup

PORTAL_EXPORT = Path(__file__).parent / "portal_export"
ATTRS_BLACKLIST = {"Итого", "Код Elevel"}
MAX_CONCURRENT = 10
REQUEST_DELAY = 0.5
REQUEST_TIMEOUT = 15
MAX_RETRIES = 2
RETRY_BACKOFF = 2  # seconds, doubles each retry
RATE_LIMIT_PAUSE = 10


def _needs_enrichment(data: dict, force: bool) -> bool:
    """Проверяет, нужно ли обогащать товар."""
    if not force and data.get("enriched"):
        return False
    url = data.get("product_url", "")
    if "complex.com.kz" not in url:
        return False
    desc = (data.get("description_html") or "").strip()
    if desc:
        return False
    attrs = data.get("attributes") or {}
    real_attrs = {k: v for k, v in attrs.items() if k not in ATTRS_BLACKLIST}
    if real_attrs:
        return False
    return True


def collect_targets(force: bool) -> list[dict]:
    """Собирает товары-цели для обогащения."""
    targets = []
    if not PORTAL_EXPORT.is_dir():
        return targets
    for model_dir in sorted(PORTAL_EXPORT.iterdir()):
        pj = model_dir / "product.json"
        if not pj.is_file():
            continue
        with open(pj, "r", encoding="utf-8") as f:
            data = json.load(f)
        if _needs_enrichment(data, force):
            targets.append({
                "model": model_dir.name,
                "path": str(pj),
                "url": data.get("product_url", ""),
                "data": data,
            })
    return targets


def _parse_jsonld_description(raw_desc: str) -> tuple[str, dict]:
    """Разделяет JSON-LD description на текстовое описание и атрибуты.

    Формат complex.com.kz:
    - Первые абзацы до "Основные характеристики" → description_html
    - Пары "Ключ\\nЗначение" после → attributes dict
    """
    if not raw_desc:
        return "", {}

    # Разделяем по маркеру характеристик
    markers = ["Основные характеристики", "Характеристики"]
    desc_part = raw_desc
    attrs_part = ""
    for marker in markers:
        if marker in raw_desc:
            idx = raw_desc.index(marker)
            desc_part = raw_desc[:idx].strip()
            attrs_part = raw_desc[idx + len(marker):].strip()
            break

    # Очистка описания — убираем повторение названия в начале
    desc_lines = [l.strip() for l in desc_part.split("\n") if l.strip()]
    # Оборачиваем в HTML абзацы
    desc_html = ""
    if desc_lines:
        # Первая строка обычно дублирует название — пропускаем
        content_lines = desc_lines[1:] if len(desc_lines) > 1 else desc_lines
        desc_html = "".join(f"<p>{line}</p>" for line in content_lines if line)

    # Парсим атрибуты — блоки разделены двойным переносом (\n\n)
    # Внутри блока: первая строка — ключ, остальные — значение
    attributes = {}
    _SECTION_HEADERS = {
        "Дополнительные характеристики", "Условия эксплуатации",
        "Стандарты", "Основные характеристики",
    }
    if attrs_part:
        # Убираем мусор в конце
        for tail in ["Паспорт, сертификаты", "Документы и материалы"]:
            if tail in attrs_part:
                attrs_part = attrs_part[:attrs_part.index(tail)]

        blocks = re.split(r"\n\s*\n", attrs_part.strip())
        for block in blocks:
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            if not lines:
                continue
            key = lines[0]
            # Пропускаем заголовки секций и мусор
            if key in _SECTION_HEADERS or key in ATTRS_BLACKLIST or len(key) > 100:
                continue
            if len(lines) >= 2:
                # Ключ на первой строке, значение на остальных
                value = " ".join(lines[1:])
            else:
                # Одна строка — ключ и значение через пробел (напр. "Серия Mureva")
                # Пропускаем если нет пробела (просто заголовок)
                if " " not in key:
                    continue
                # Не разбиваем — сохраняем как есть (ключ = полная строка)
                # Это специфика complex.com.kz: "Серия Mureva" значит attr("Серия", "Mureva")
                # Но определить точную границу сложно, сохраняем целиком
                value = key
                key = key  # будет ключ = значение, что бесполезно → пропускаем
                continue
            if value and len(value) < 500:
                attributes[key] = value

    return desc_html, attributes


def parse_product_page(html: str) -> dict | None:
    """Извлекает данные из HTML страницы complex.com.kz.

    Парсит JSON-LD (type=Product) для описания и бренда.
    Возвращает dict(description_html, attributes, brand) или None.
    """
    soup = BeautifulSoup(html, "lxml")

    # Ищем JSON-LD с типом Product
    product_data = None
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict) and data.get("@type") == "Product":
                product_data = data
                break
        except (json.JSONDecodeError, TypeError):
            continue

    if not product_data:
        return None

    raw_desc = product_data.get("description", "")
    desc_html, attributes = _parse_jsonld_description(raw_desc)

    brand = ""
    brand_data = product_data.get("brand")
    if isinstance(brand_data, dict):
        brand = brand_data.get("name", "")
    elif isinstance(brand_data, str):
        brand = brand_data

    if not desc_html and not attributes and not brand:
        return None

    return {
        "description_html": desc_html,
        "attributes": attributes,
        "brand": brand,
    }


def save_enriched(target: dict, parsed: dict) -> None:
    """Сохраняет обогащённые данные в product.json."""
    data = target["data"]

    if parsed["description_html"] and not (data.get("description_html") or "").strip():
        data["description_html"] = parsed["description_html"]

    if parsed["attributes"]:
        existing = data.get("attributes") or {}
        real_existing = {k: v for k, v in existing.items() if k not in ATTRS_BLACKLIST}
        if not real_existing:
            # Сохраняем blacklisted ключи + новые атрибуты
            merged = {k: v for k, v in existing.items() if k in ATTRS_BLACKLIST}
            merged.update(parsed["attributes"])
            data["attributes"] = merged

    if parsed["brand"] and not (data.get("brand") or "").strip():
        data["brand"] = parsed["brand"]

    data["enriched"] = True

    with open(target["path"], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_failed(target: dict) -> None:
    """Помечает товар как failed."""
    data = target["data"]
    data["enriched"] = "failed"
    with open(target["path"], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


async def fetch_page(session: aiohttp.ClientSession, url: str) -> str | None:
    """Загружает страницу с retry и backoff."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
                headers={"User-Agent": "Mozilla/5.0 (compatible; GRGroup/1.0)"},
            ) as resp:
                if resp.status == 429:
                    await asyncio.sleep(RATE_LIMIT_PAUSE)
                    continue
                if resp.status == 404:
                    return None
                resp.raise_for_status()
                return await resp.text()
        except (aiohttp.ClientError, asyncio.TimeoutError):
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_BACKOFF * (2 ** attempt))
            else:
                return None
    return None


async def process_target(
    sem: asyncio.Semaphore,
    session: aiohttp.ClientSession,
    target: dict,
    index: int,
    total: int,
    stats: dict,
) -> None:
    """Обрабатывает один товар."""
    async with sem:
        await asyncio.sleep(REQUEST_DELAY)

        html = await fetch_page(session, target["url"])
        if not html:
            save_failed(target)
            stats["failed"] += 1
            print(f"[{index}/{total}] failed   {target['model']} — no response")
            return

        parsed = parse_product_page(html)
        if not parsed:
            save_failed(target)
            stats["failed"] += 1
            print(f"[{index}/{total}] failed   {target['model']} — no data in page")
            return

        save_enriched(target, parsed)
        stats["enriched"] += 1
        n_attrs = len(parsed.get("attributes", {}))
        desc_len = len(parsed.get("description_html", ""))
        print(f"[{index}/{total}] enriched {target['model']} — {n_attrs} attrs, description {desc_len} chars")


async def run(targets: list[dict]) -> dict:
    """Запускает обогащение для всех целей."""
    stats = {"enriched": 0, "failed": 0, "skipped": 0}
    total = len(targets)

    sem = asyncio.Semaphore(MAX_CONCURRENT)
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            process_target(sem, session, target, i + 1, total, stats)
            for i, target in enumerate(targets)
        ]
        await asyncio.gather(*tasks)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Обогащение product.json из complex.com.kz")
    parser.add_argument("--dry-run", action="store_true", help="Только подсчёт целей")
    parser.add_argument("--limit", type=int, default=0, help="Обработать первые N товаров")
    parser.add_argument("--force", action="store_true", help="Игнорировать флаг enriched")
    args = parser.parse_args()

    print("Сбор целей...")
    targets = collect_targets(args.force)
    print(f"Найдено {len(targets)} товаров для обогащения")

    if args.dry_run:
        return

    if args.limit > 0:
        targets = targets[:args.limit]
        print(f"Лимит: {args.limit} товаров")

    if not targets:
        print("Нет товаров для обогащения.")
        return

    start = time.time()
    stats = asyncio.run(run(targets))
    elapsed = time.time() - start

    print(f"\nDone in {elapsed:.0f}s: enriched {stats['enriched']}, "
          f"failed {stats['failed']}, skipped {stats['skipped']}")


if __name__ == "__main__":
    main()
