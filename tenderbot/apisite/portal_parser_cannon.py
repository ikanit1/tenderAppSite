"""
Парсер-«пушка»: asyncio + httpx, 20–50 запросов/сек.
Один раз логин → куки в файл → работа без браузера.
Пропуск уже спарсенных товаров (по URL).
"""
import re
import json
import asyncio
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any, Set
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from product_image_parser import (
    BASE_URL,
    PORTAL_URL,
    LOGIN_URL,
    LOGIN_USERNAME,
    LOGIN_PASSWORD,
    normalize_image_url,
    extract_model_from_text,
    extract_model_from_url,
)
from portal_full_parser_browser import (
    get_product_entries_from_html,
    parse_product_page_html,
    CatalogEntry,
    ProductFull,
    sanitize_foldername,
    ensure_unique_folder,
    EXPORT_DIR,
    ITEMS_JSON_PATH,
    EXCLUDE_KEYS,
    _is_excluded_key,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
COOKIES_FILE = DATA_DIR / "portal_cookies.json"
PARSED_FILE = DATA_DIR / "portal_parsed.json"

START_PAGE = 1
END_PAGE = 116
CONCURRENCY = 8  # 5–10 оптимально для OpenCart, 30 вызывает DDoS-защиту
REQUEST_TIMEOUT = 20.0


def load_cookies() -> List[Dict[str, str]]:
    if not COOKIES_FILE.exists():
        return []
    try:
        data = json.loads(COOKIES_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_cookies(cookies: list) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = [{"name": c.get("name"), "value": c.get("value"), "domain": c.get("domain", "")} for c in cookies]
    COOKIES_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")
    logger.info("Куки сохранены в %s", COOKIES_FILE)


def load_parsed() -> Set[str]:
    if not PARSED_FILE.exists():
        return set()
    try:
        data = json.loads(PARSED_FILE.read_text(encoding="utf-8"))
        urls = data.get("parsed_urls", data) if isinstance(data, dict) else data
        return set(urls) if isinstance(urls, list) else set()
    except Exception:
        return set()


def save_parsed(parsed: Set[str]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PARSED_FILE.write_text(json.dumps({"parsed_urls": list(parsed)}, indent=2), encoding="utf-8")


def _guess_login_form_fields(form) -> tuple[Optional[str], Optional[str]]:
    """
    Возвращает (username_field_name, password_field_name) для формы логина.
    Стараемся поддержать типичные формы OpenCart (telephone/email + password).
    """
    pwd = form.select_one("input[type='password'][name]") if form else None
    pwd_name = (pwd.get("name") if pwd else None)

    # Находим "логин" по наиболее вероятным селекторам.
    user = None
    if form:
        selectors = [
            "input[type='tel'][name]",
            "input[type='email'][name]",
            "input[name*='telephone' i]",
            "input[name*='phone' i]",
            "input[name*='email' i]",
            "input[name*='login' i]",
            "input[name*='username' i]",
        ]
        for sel in selectors:
            user = form.select_one(sel)
            if user and user.get("name"):
                break
    user_name = (user.get("name") if user else None)

    # Fallback: первый text/tel/email input с name, который не password.
    if form and not user_name:
        for inp in form.select("input[name]"):
            t = (inp.get("type") or "text").lower()
            if t in ("hidden", "submit", "button", "password", "checkbox", "radio", "file"):
                continue
            name = inp.get("name")
            if name and name != pwd_name:
                user_name = name
                break

    return user_name, pwd_name


def run_http_login_and_save_cookies() -> bool:
    """Один раз: логин через httpx, сохранение куки в файл."""
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    }
    timeout = httpx.Timeout(20.0, connect=10.0)

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as c:
            r = c.get(LOGIN_URL)
            if r.status_code != 200:
                logger.error("Не удалось открыть страницу логина (%s): %s", LOGIN_URL, r.status_code)
                return False

            soup = BeautifulSoup(r.text, "html.parser")
            form = soup.find("form")
            if not form:
                logger.error("Форма логина не найдена на странице %s", LOGIN_URL)
                return False

            user_field, pwd_field = _guess_login_form_fields(form)
            if not user_field or not pwd_field:
                logger.error("Не удалось определить поля логина (user=%s, pwd=%s)", user_field, pwd_field)
                return False

            # Собираем payload (включая скрытые поля/CSRF, если есть)
            payload: Dict[str, str] = {}
            for inp in form.select("input[name]"):
                name = inp.get("name")
                if not name:
                    continue
                t = (inp.get("type") or "").lower()
                if t in ("submit", "button", "file"):
                    continue
                payload[name] = inp.get("value") or ""

            payload[user_field] = LOGIN_USERNAME
            payload[pwd_field] = LOGIN_PASSWORD

            action = form.get("action") or LOGIN_URL
            post_url = action if action.startswith("http") else urljoin(BASE_URL, action)

            pr = c.post(post_url, data=payload)
            if pr.status_code not in (200, 302):
                logger.error("Логин POST вернул статус %s", pr.status_code)
                return False

            # Проверка: доступ к порталу не должен редиректить на login
            check = c.get(PORTAL_URL)
            if check.status_code == 200 and "login" not in str(check.url).lower():
                # httpx хранит куки в c.cookies.jar
                cookies_out: list[dict] = []
                for cookie in c.cookies.jar:
                    cookies_out.append(
                        {
                            "name": cookie.name,
                            "value": cookie.value,
                            "domain": cookie.domain or "",
                        }
                    )
                save_cookies(cookies_out)
                return True

            logger.error("После логина портал всё ещё требует авторизацию (url=%s)", str(check.url))
            return False
    except Exception as e:
        logger.error("Ошибка логина через HTTP: %s", e)
        return False


def ensure_cookies() -> List[Dict[str, str]]:
    cookies = load_cookies()
    if cookies:
        try:
            with httpx.Client(timeout=10, follow_redirects=True) as c:
                for co in cookies:
                    c.cookies.set(co["name"], co["value"], domain=co.get("domain", ""))
                r = c.get(PORTAL_URL)
                if r.status_code == 200 and "login" not in str(r.url).lower():
                    logger.info("Куки из файла валидны")
                    return cookies
        except Exception:
            pass
    logger.info("Требуется логин: выполняю авторизацию и сохраняю cookies...")
    if not run_http_login_and_save_cookies():
        return []
    return load_cookies()


def cookies_to_httpx(cookies: List[Dict[str, str]]) -> Dict[str, str]:
    return {c["name"]: c["value"] for c in cookies if c.get("name") and c.get("value")}


async def fetch_catalog_page(client: httpx.AsyncClient, page: int) -> List[CatalogEntry]:
    url = f"{PORTAL_URL}?sort=p.sort_order&order=ASC&page={page}"
    r = await client.get(url)
    if r.status_code != 200:
        return []
    return get_product_entries_from_html(r.text)


async def fetch_product(client: httpx.AsyncClient, entry: CatalogEntry) -> Optional[ProductFull]:
    if not entry.product_url:
        return None
    for attempt in range(3):
        try:
            await asyncio.sleep(0.1 * attempt)
            r = await client.get(entry.product_url)
            if r.status_code == 200:
                return parse_product_page_html(r.text, BASE_URL)
            if r.status_code == 404:
                return None
        except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.ReadError) as e:
            if attempt == 2:
                logger.warning("Сервер сбросил соединение на товаре %s: %s", entry.product_url[:60], e)
            await asyncio.sleep(1)
    return None


async def download_image(client: httpx.AsyncClient, url: str, path: Path) -> bool:
    try:
        if path.exists():
            return True
        path.parent.mkdir(parents=True, exist_ok=True)
        r = await client.get(url)
        if r.status_code != 200:
            return False
        path.write_bytes(r.content)
        return True
    except Exception:
        return False


async def process_product(
    client: httpx.AsyncClient,
    entry: CatalogEntry,
    sem: asyncio.Semaphore,
    parsed: Set[str],
    all_items: List[Dict],
    save_parsed_every: int = 50,
) -> None:
    async with sem:
        if entry.product_url in parsed:
            return
        try:
            product = await fetch_product(client, entry)
        except Exception as e:
            logger.warning("Ошибка при загрузке товара %s: %s", entry.product_url[:60] if entry.product_url else entry.model, e)
            return
        if not product:
            return
        if not product.name:
            product = ProductFull(
                name=entry.name,
                description=product.description,
                image_urls=product.image_urls,
                json_data=product.json_data,
            )
        if not product.image_urls and entry.thumb_url:
            product.image_urls.append(entry.thumb_url)

        folder_name = entry.model or entry.name or "product"
        safe_name = sanitize_foldername(folder_name)
        product_dir = ensure_unique_folder(EXPORT_DIR / safe_name)
        product_dir.mkdir(parents=True, exist_ok=True)

        name_to_save = product.name or entry.name or entry.model
        all_images = list(product.image_urls)
        if entry.thumb_url and entry.thumb_url not in all_images:
            all_images.insert(0, entry.thumb_url)

        saved_files: List[str] = []
        for i, img_url in enumerate(all_images, 1):
            ext = ".jpg"
            if ".png" in img_url.lower():
                ext = ".png"
            elif ".webp" in img_url.lower():
                ext = ".webp"
            fname = f"image_{i:02d}{ext}"
            saved_files.append(fname)
            await download_image(client, img_url, product_dir / fname)

        json_data = dict(product.json_data or {})
        json_data["model"] = entry.model
        json_data["name"] = name_to_save
        json_data["product_url"] = entry.product_url
        json_data["description"] = product.description or ""
        json_data["images"] = saved_files
        json_data["images_count"] = len(saved_files)
        for key in list(json_data.get("attributes", {}).keys()):
            if _is_excluded_key(key):
                json_data["attributes"].pop(key, None)
        if json_data.get("attributes") == {}:
            json_data.pop("attributes", None)
        (product_dir / "product.json").write_text(json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8")
        (product_dir / "name.txt").write_text(name_to_save, encoding="utf-8")
        (product_dir / "description.txt").write_text(product.description or "", encoding="utf-8")

        price_val = (product.json_data or {}).get("price")
        all_items.append({
            "model": entry.model,
            "name": name_to_save,
            "price": int(price_val) if price_val is not None else 0,
            "descr": product.description or "",
            "category": (product.json_data or {}).get("category", "") or "",
            "image": list(product.image_urls),
        })

        if entry.product_url:
            parsed.add(entry.product_url)
        if len(parsed) % save_parsed_every == 0:
            save_parsed(parsed)
            logger.info("Проверено/сохранено: %s товаров", len(parsed))


async def run_cannon(
    start_page: int = START_PAGE,
    end_page: int = END_PAGE,
    only_expected_folders: Optional[Set[str]] = None,
) -> None:
    """
    Парсит каталог портала, создаёт папки в portal_export.
    Если задан only_expected_folders (нормализованные имена папок), обрабатываются только
    товары, чьё имя папки (sanitize_foldername(model|name)) входит в этот набор.
    """
    cookies_list = ensure_cookies()
    if not cookies_list:
        logger.error("Не удалось получить куки. Завершение.")
        return

    parsed = load_parsed()
    logger.info("Уже спарсено (пропуск): %s URL", len(parsed))
    if only_expected_folders:
        logger.info("Режим «только недостающие»: %s наименований", len(only_expected_folders))

    existing_items: List[Dict] = []
    if ITEMS_JSON_PATH.exists():
        try:
            data = json.loads(ITEMS_JSON_PATH.read_text(encoding="utf-8"))
            existing_items = data.get("items", [])
        except Exception:
            pass

    all_items: List[Dict] = []
    sem = asyncio.Semaphore(CONCURRENCY)
    jar = cookies_to_httpx(cookies_list)

    def should_process(entry: CatalogEntry) -> bool:
        if entry.product_url and entry.product_url in parsed:
            return False
        if only_expected_folders is not None:
            candidate = sanitize_foldername(entry.model or entry.name or "product")
            if candidate not in only_expected_folders:
                return False
        return True

    async with httpx.AsyncClient(
        timeout=REQUEST_TIMEOUT,
        follow_redirects=True,
        limits=httpx.Limits(max_connections=CONCURRENCY, max_keepalive_connections=5),
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        cookies=jar,
    ) as client:
        for page in range(start_page, end_page + 1):
            logger.info("--- Загрузка страницы каталога %s ---", page)
            entries = await fetch_catalog_page(client, page)
            if not entries:
                continue
            tasks = [
                process_product(client, e, sem, parsed, all_items)
                for e in entries
                if should_process(e)
            ]
            if tasks:
                await asyncio.gather(*tasks)
            logger.info("Страница %s/%s: обработано записей с каталога", page, end_page)
            await asyncio.sleep(0.5)

    save_parsed(parsed)
    merged = existing_items + all_items
    ITEMS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    ITEMS_JSON_PATH.write_text(
        json.dumps({"items": merged}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logger.info("Готово. Всего товаров в items.json: %s. Новых за этот запуск: %s", len(merged), len(all_items))


def main():
    import argparse
    p = argparse.ArgumentParser(description="Парсер-пушка: asyncio+httpx, куки из файла, пропуск уже спарсенных.")
    p.add_argument("--start", type=int, default=START_PAGE)
    p.add_argument("--end", type=int, default=END_PAGE)
    args = p.parse_args()
    asyncio.run(run_cannon(args.start, args.end))


if __name__ == "__main__":
    main()
