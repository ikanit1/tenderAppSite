"""
Парсер портала complex.com.kz/portal через видимый Google Chrome.
Страницы 1–116, каждая позиция в свою папку: название, описание, изображения.
Браузер: C:\Program Files\Google\Chrome\Application\chrome.exe
"""
import re
import json
import time
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any, Tuple
from urllib.parse import urljoin
from dataclasses import dataclass, field

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import requests

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
from config import SCRAPING_DELAY

# Ускорение ~2x: уменьшенные задержки + параллельная загрузка изображений
PAGE_LOAD_WAIT = 1.0          # после загрузки страницы каталога (было 2)
PRODUCT_PAGE_WAIT = 0.7       # после загрузки карточки товара (было 1.5)
BETWEEN_PRODUCT_DELAY = max(0.25, SCRAPING_DELAY * 0.4)  # между товарами
IMAGE_DOWNLOAD_WORKERS = 6    # потоков для параллельной загрузки фото

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

EXPORT_DIR = Path(__file__).parent / "portal_export"
ITEMS_JSON_PATH = EXPORT_DIR / "items.json"
DATA_DIR = Path(__file__).parent / "data"
PARSED_FILE = DATA_DIR / "portal_parsed.json"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
START_PAGE = 1
END_PAGE = 116


@dataclass
class CatalogEntry:
    model: str
    name: str
    product_url: str
    thumb_url: Optional[str] = None


# Поля, которые не включаем в JSON (цены и остатки)
EXCLUDE_KEYS = frozenset({
    "цена", "цену", "цены", "price", "prices", "стоимость", "сумма",
    "остаток", "остатк", "количество", "кол-во", "quantity", "stock", "в наличии",
    "шт", "штук", "штуки", "qty", "наличие",
})

@dataclass
class ProductFull:
    name: str
    description: str
    image_urls: List[str]
    # Полные данные для JSON (описание раздела без цен и остатков)
    json_data: Dict[str, Any] = field(default_factory=dict)


def sanitize_foldername(s: str, max_len: int = 120) -> str:
    """Имя папки (то же правило, что в API: model_to_foldername)."""
    from utils import model_to_foldername
    return model_to_foldername(s, max_len=max_len)


def create_driver(headless: bool = False) -> webdriver.Chrome:
    """Chrome: headless по желанию (--headless=new даёт +30–50% скорости)."""
    opts = Options()
    opts.binary_location = CHROME_PATH
    if headless:
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--no-sandbox")
    else:
        opts.add_argument("--start-maximized")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    driver = webdriver.Chrome(options=opts)
    driver.implicitly_wait(10)
    return driver


def load_parsed_urls() -> set:
    if not PARSED_FILE.exists():
        return set()
    try:
        data = json.loads(PARSED_FILE.read_text(encoding="utf-8"))
        urls = data.get("parsed_urls", data) if isinstance(data, dict) else data
        return set(urls) if isinstance(urls, list) else set()
    except Exception:
        return set()


def save_parsed_urls(parsed: set) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PARSED_FILE.write_text(json.dumps({"parsed_urls": list(parsed)}, indent=2), encoding="utf-8")


def login_browser(driver: webdriver.Chrome) -> bool:
    """Авторизация в браузере: открываем страницу логина, вводим данные, отправляем."""
    try:
        logger.info("Открываем страницу входа...")
        driver.get(LOGIN_URL)
        time.sleep(2)

        # Поле телефона
        tel = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='tel'], input[name*='telephone'], input[name*='phone'], input[name*='email']"))
        )
        tel.clear()
        tel.send_keys(LOGIN_USERNAME)
        time.sleep(0.3)

        # Пароль
        pwd = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        pwd.clear()
        pwd.send_keys(LOGIN_PASSWORD)
        time.sleep(0.3)

        # Кнопка входа
        btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit'], .btn-primary, [type='submit']")
        btn.click()
        time.sleep(3)

        if "login" in driver.current_url.lower():
            logger.warning("После отправки формы всё ещё на странице логина. Проверьте учётные данные.")
            return False
        logger.info("Авторизация в браузере успешна.")
        return True
    except Exception as e:
        logger.error(f"Ошибка авторизации в браузере: {e}", exc_info=True)
        return False


def get_product_entries_from_html(html: str) -> List[CatalogEntry]:
    """Парсит HTML страницы каталога и возвращает список записей."""
    entries: List[CatalogEntry] = []
    soup = BeautifulSoup(html, "lxml")
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
        product_rows = [r for r in soup.find_all("tr") if r.find("img", src=re.compile(r"/image/cache/"))]

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
    return entries


def _is_excluded_key(key: str) -> bool:
    """Исключаем поля с ценой и остатком."""
    k = (key or "").strip().lower()
    return any(ex in k for ex in EXCLUDE_KEYS)


def _extract_images_from_product_images(soup: BeautifulSoup, base_url: str) -> List[str]:
    """Извлекает URL картинок из контейнера id='productImages'."""
    urls: List[str] = []
    block = soup.find(id="productImages")
    if not block:
        return urls
    for img in block.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or img.get("data-original")
        if not src:
            continue
        u = normalize_image_url(src) if "/image/cache/" in src else (urljoin(base_url, src) if not src.startswith("http") else src)
        if u and u not in urls:
            urls.append(u)
    for a in block.find_all("a", href=re.compile(r"image|\.(jpg|jpeg|png|webp)", re.I)):
        href = a.get("href")
        if href:
            u = urljoin(base_url, href) if not href.startswith("http") else href
            if u not in urls:
                urls.append(u)
    return urls


def _extract_price(soup: BeautifulSoup) -> Optional[float]:
    """Извлекает цену со страницы (число)."""
    for el in soup.find_all(class_=re.compile(r"price", re.I)) + soup.find_all("span", {"itemprop": "price"}):
        text = el.get_text(strip=True) or el.get("content", "")
        if not text:
            continue
        num = re.sub(r"[^\d.,]", "", text.replace(",", "."))
        if num:
            try:
                return float(num)
            except ValueError:
                pass
    return None


def _extract_attributes(soup: BeautifulSoup) -> Dict[str, Any]:
    """Извлекает атрибуты/характеристики из таблиц (без цен и остатков)."""
    attrs: Dict[str, Any] = {}
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) >= 2:
                key = tds[0].get_text(strip=True)
                if key and not _is_excluded_key(key):
                    attrs[key] = tds[1].get_text(separator=" ", strip=True)
        if attrs:
            break
    if not attrs:
        for dl in soup.find_all("dl") + soup.find_all("div", class_=re.compile(r"attribute|specification|characteristic", re.I)):
            for dt in dl.find_all("dt") + dl.find_all("span", class_=re.compile(r"label|name", re.I)):
                key = dt.get_text(strip=True)
                if not key or _is_excluded_key(key):
                    continue
                dd = dt.find_next_sibling(["dd", "div", "span"]) or dt.find_next()
                if dd:
                    attrs[key] = dd.get_text(separator=" ", strip=True)
    return attrs


def parse_product_page_html(html: str, base_url: str) -> ProductFull:
    """Парсит HTML страницы товара: название, описание, все изображения, все данные для JSON (без цен и остатков)."""
    name = ""
    description = ""
    image_urls: List[str] = []
    soup = BeautifulSoup(html, "lxml")

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

    # Приоритет: картинки из #productImages
    image_urls = _extract_images_from_product_images(soup, base_url)
    if not image_urls:
        for img in soup.find_all("img", src=re.compile(r"/image/cache/|/image/catalog/")):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or img.get("data-original")
            if not src:
                continue
            orig = normalize_image_url(src) if "/image/cache/" in src else (urljoin(base_url, src) if not src.startswith("http") else src)
            if orig and orig not in image_urls:
                image_urls.append(orig)
    if not image_urls:
        for img in soup.find_all("img", src=re.compile(r"/image/")):
            src = img.get("src") or img.get("data-src")
            if src:
                u = urljoin(base_url, src) if not src.startswith("http") else src
                if u not in image_urls:
                    image_urls.append(u)

    price = _extract_price(soup)
    # Собираем полное описание раздела для JSON (без цен и остатков)
    json_data: Dict[str, Any] = {
        "name": name,
        "price": int(price) if price is not None else None,
        "description": description,
        "description_html": "",
        "attributes": _extract_attributes(soup),
        "tabs": {},
        "images_count": len(image_urls),
    }
    if desc_block:
        json_data["description_html"] = desc_block.decode_contents() if hasattr(desc_block, "decode_contents") else str(desc_block)

    # Доп. вкладки (характеристики, отзывы и т.д. — только текст, без цен)
    for tab in soup.find_all("div", id=re.compile(r"tab-|description")):
        tab_id = tab.get("id", "")
        if not tab_id or tab_id == "tab-description":
            continue
        text = tab.get_text(separator="\n", strip=True)
        if text and not any(ex in tab_id.lower() for ex in ("price", "cart", "buy")):
            json_data["tabs"][tab_id] = text

    # Модель/артикул/бренд из страницы
    for meta in soup.find_all("span", class_=re.compile(r"model|sku|brand|manufacturer", re.I)) + soup.find_all("li", class_=re.compile(r"model|sku", re.I)):
        label = meta.get_text(strip=True)
        if label and ":" in label:
            k, v = label.split(":", 1)
            k, v = k.strip(), v.strip()
            if k and v and not _is_excluded_key(k):
                json_data["attributes"][k] = v
    if not json_data["attributes"]:
        json_data["attributes"] = _extract_attributes(soup)

    return ProductFull(name=name, description=description, image_urls=image_urls, json_data=json_data)


def download_image_with_cookies(url: str, save_path: Path, cookies: list) -> bool:
    """Скачивает изображение, подставляя cookies из браузера."""
    try:
        if save_path.exists():
            return True
        save_path.parent.mkdir(parents=True, exist_ok=True)
        session = requests.Session()
        for c in cookies:
            session.cookies.set(c.get("name"), c.get("value", ""), domain=c.get("domain", ""))
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Referer": BASE_URL,
        })
        r = session.get(url, timeout=15, stream=True)
        if r.status_code != 200:
            return False
        with open(save_path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        logger.debug(f"Ошибка загрузки {url}: {e}")
        return False


def ensure_unique_folder(base_path: Path) -> Path:
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
    cookies: list,
) -> Path:
    """Папка по модели: все фотографии раздела + один JSON с полным описанием (без цен и остатков)."""
    safe_name = sanitize_foldername(folder_name)
    base = EXPORT_DIR / safe_name
    product_dir = ensure_unique_folder(base)
    product_dir.mkdir(parents=True, exist_ok=True)

    name_to_save = product.name or catalog_entry.name or catalog_entry.model
    all_images = list(product.image_urls)
    if thumb_url and thumb_url not in all_images:
        all_images.insert(0, thumb_url)

    # Параллельная загрузка всех фото (ускорение ~2x)
    tasks: List[Tuple[str, Path]] = []
    for i, img_url in enumerate(all_images, 1):
        ext = ".jpg"
        if ".png" in img_url.lower():
            ext = ".png"
        elif ".webp" in img_url.lower():
            ext = ".webp"
        fname = f"image_{i:02d}{ext}"
        tasks.append((img_url, product_dir / fname))
    saved_image_files = [p.name for _, p in tasks]
    with ThreadPoolExecutor(max_workers=IMAGE_DOWNLOAD_WORKERS) as ex:
        list(ex.map(lambda t: download_image_with_cookies(t[0], t[1], cookies), tasks))

    # Один JSON: полное описание раздела (без цен и количества/остатка)
    json_data = dict(product.json_data) if product.json_data else {}
    json_data["model"] = catalog_entry.model
    json_data["name"] = name_to_save
    json_data["product_url"] = catalog_entry.product_url
    json_data["description"] = product.description or ""
    json_data["images"] = saved_image_files
    json_data["images_count"] = len(saved_image_files)
    # Убеждаемся, что в JSON нет цен и остатков
    for key in list(json_data.get("attributes", {}).keys()):
        if _is_excluded_key(key):
            json_data["attributes"].pop(key, None)
    if "attributes" in json_data and not json_data["attributes"]:
        json_data.pop("attributes", None)

    (product_dir / "product.json").write_text(
        json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (product_dir / "name.txt").write_text(name_to_save, encoding="utf-8")
    (product_dir / "description.txt").write_text(product.description or "", encoding="utf-8")

    return product_dir


def run_parser(start_page: int = START_PAGE, end_page: int = END_PAGE, headless: bool = False) -> None:
    driver = None
    try:
        driver = create_driver(headless=headless)
        if not login_browser(driver):
            return

        parsed_urls = load_parsed_urls()
        logger.info("Уже спарсено (пропуск): %s URL", len(parsed_urls))
        seen_urls: set = set()
        all_items: List[Dict[str, Any]] = []
        existing_items: List[Dict[str, Any]] = []
        if ITEMS_JSON_PATH.exists():
            try:
                data = json.loads(ITEMS_JSON_PATH.read_text(encoding="utf-8"))
                existing_items = data.get("items", [])
            except Exception:
                pass

        for page in range(start_page, end_page + 1):
            url = f"{PORTAL_URL}?sort=p.sort_order&order=ASC&page={page}"
            logger.info(f"Страница {page}/{end_page}: {url}")
            driver.get(url)
            time.sleep(PAGE_LOAD_WAIT)

            html = driver.page_source
            entries = get_product_entries_from_html(html)
            if not entries:
                logger.warning(f"Страница {page}: товары не найдены")
                time.sleep(SCRAPING_DELAY)
                continue

            for entry in entries:
                if entry.product_url and (entry.product_url in seen_urls or entry.product_url in parsed_urls):
                    continue
                if entry.product_url:
                    seen_urls.add(entry.product_url)

                product = ProductFull(name=entry.name, description="", image_urls=[], json_data={})
                if entry.product_url:
                    driver.get(entry.product_url)
                    time.sleep(PRODUCT_PAGE_WAIT)
                    product = parse_product_page_html(driver.page_source, BASE_URL)
                if not product.name:
                    product = ProductFull(
                        name=entry.name,
                        description=product.description,
                        image_urls=product.image_urls,
                        json_data=product.json_data,
                    )
                if not product.image_urls and entry.thumb_url:
                    product.image_urls.append(entry.thumb_url)

                # Элемент для единого items.json (URL картинок из #productImages или все image_urls)
                image_urls_for_item = list(product.image_urls)
                price_val = (product.json_data or {}).get("price")
                all_items.append({
                    "model": entry.model,
                    "name": product.name or entry.name or entry.model,
                    "price": int(price_val) if price_val is not None else 0,
                    "descr": product.description or "",
                    "category": (product.json_data or {}).get("category", "") or "",
                    "image": image_urls_for_item,
                })

                cookies = driver.get_cookies()
                folder_name = entry.model or entry.name or "product"
                save_product_to_folder(folder_name, entry, product, entry.thumb_url, cookies)
                if entry.product_url:
                    parsed_urls.add(entry.product_url)
                    if len(parsed_urls) % 50 == 0:
                        save_parsed_urls(parsed_urls)
                time.sleep(BETWEEN_PRODUCT_DELAY)

            time.sleep(BETWEEN_PRODUCT_DELAY)

        save_parsed_urls(parsed_urls)
        merged = existing_items + all_items
        if merged:
            ITEMS_JSON_PATH.write_text(
                json.dumps({"items": merged}, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            logger.info(f"Сохранён единый файл: {ITEMS_JSON_PATH} (всего {len(merged)} товаров, новых {len(all_items)})")

        logger.info(f"Экспорт завершён. Папки: {EXPORT_DIR.absolute()}")
    finally:
        if driver:
            logger.info("Закройте окно Chrome или нажмите Enter для выхода...")
            input()
            driver.quit()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Парсер portal через Chrome. --headless быстрее на 30–50%.")
    parser.add_argument("--start", type=int, default=START_PAGE)
    parser.add_argument("--end", type=int, default=END_PAGE)
    parser.add_argument("--headless", action="store_true", help="Без окна браузера (--headless=new)")
    args = parser.parse_args()
    run_parser(args.start, args.end, headless=args.headless)
