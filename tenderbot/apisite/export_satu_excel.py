#!/usr/bin/env python3
"""
Скрипт формирует Excel для импорта в SATU в формате XLS/XLSX по документации портала.

Важно: SATU не читает картинки из ячеек Excel. Импорт фото возможен только по URL в колонке
«Ссылка_изображения» (формат: https://..., несколько ссылок через запятую с пробелом).

Как передать фото в SATU:
  1) --image-via-api — ссылки на фото через ваш же API (main.py): /api/products/{модель}/image.
     Подходит, если apisite доступен по SITEMAP_BASE_URL (напр. https://grgroup.kz). Ничего выкладывать не нужно.
  2) --image-base-url URL — если выложите папки portal_export на другой сервер; в Excel подставятся URL/папка/файл.jpg
  3) После импорта Excel: python update_satu_products.py — фото дозагрузятся в SATU по API

- Вкладка «Export Products Sheet» — товары с обязательными полями SATU (формат по документации).
- Вкладка «Export Groups Sheet» — минимальная структура групп.

По умолчанию данные берутся из API (B2B) с подстановкой описания и изображений из portal_export.
  --from-api (по умолчанию) — загрузка из B2B + слияние с portal_export, цены со скидками.
  --no-from-api — только portal_export (как раньше).

Запуск:
  python export_satu_excel.py --image-via-api
  python export_satu_excel.py -o data/satu_import.xlsx --image-base-url "https://site.com/catalog/"
  python export_satu_excel.py --limit 100
  python export_satu_excel.py --no-from-api   # только из portal_export
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

_apisite_dir = Path(__file__).resolve().parent
if str(_apisite_dir) not in sys.path:
    sys.path.insert(0, str(_apisite_dir))

from upload_to_satu import load_products_from_portal
from utils import model_to_foldername, get_clean_id, normalize_model_for_fs

try:
    import openpyxl
except ImportError:
    print("Установите openpyxl: pip install openpyxl")
    sys.exit(1)

# Ограничения SATU
MAX_NAZVA = 100
MAX_OPISANIE = 12160
MAX_POISK_ZAPROS = 255
MAX_KOD_TOVARA = 25
MAX_PROIZVODITEL = 255
MAX_IDENTIFIKATOR = 255

# Заголовки вкладки «Export Products Sheet» (формат SATU)
HEADERS_PRODUCTS = (
    "Код_товара",
    "Название_позиции",
    "Поисковые_запросы",
    "Описание",
    "Тип_товара",
    "Цена",
    "Цена от",
    "Валюта",
    "Единица_измерения",
    "Минимальный_объем_заказа",
    "Оптовая_цена",
    "Минимальный_заказ_опт",
    "Количество",
    "Ссылка_изображения",
    "Наличие",
    "Идентификатор_товара",
    "Производитель",
)

PORTAL_EXPORT_DIR = _apisite_dir / "portal_export"


def _get_api_base_url() -> str:
    """Базовый URL сайта (apisite), откуда отдаются изображения по /api/products/{model}/image."""
    try:
        from config import SITEMAP_BASE_URL
        return (SITEMAP_BASE_URL or "").strip().rstrip("/") or ""
    except Exception:
        return ""


def _normalize_price_rrc(p: dict) -> float:
    """Нормализация розничной цены (логика как в main.py / export_catalog_to_excel)."""
    price_rrc_raw = p.get("price_rrc")
    price_client_raw = p.get("price_client")
    if price_rrc_raw is None or price_rrc_raw == "" or float(price_rrc_raw or 0) == 0:
        if price_client_raw not in (None, "") and float(price_client_raw or 0) > 0:
            price_rrc_raw = price_client_raw
        else:
            price_rrc_raw = p.get("price") or p.get("cost") or p.get("retail_price")
    if price_rrc_raw is None or price_rrc_raw == "":
        price_rrc_raw = p.get("price") or p.get("cost") or p.get("retail_price") or 0
    if isinstance(price_rrc_raw, str):
        try:
            return float(price_rrc_raw.replace(",", "."))
        except (ValueError, AttributeError):
            return 0.0
    try:
        return float(price_rrc_raw)
    except (ValueError, TypeError):
        return 0.0


def is_valid_price(price: float | None) -> bool:
    """Возвращает True только если цена реальная и адекватная. Иначе — пустая ячейка (цена по запросу)."""
    if price is None:
        return False
    if price <= 0.01:
        return False
    if price >= 9_000_000:
        return False
    return True


def _build_portal_by_model() -> dict:
    """
    Строит словарь для слияния с API: по разным ключам (model, folder_name, clean_id)
    возвращается {description, image_paths, folder} из portal_export.
    """
    result = {}
    if not PORTAL_EXPORT_DIR.is_dir():
        return result

    for folder in sorted(PORTAL_EXPORT_DIR.iterdir()):
        if not folder.is_dir():
            continue
        product_json = folder / "product.json"
        if not product_json.exists():
            continue
        try:
            data = json.loads(product_json.read_bytes())
        except Exception:
            continue

        name = (data.get("name") or "").strip() or ((folder / "name.txt").read_bytes().decode("utf-8-sig", errors="replace").strip() if (folder / "name.txt").exists() else "")
        if not name:
            name = folder.name
        model = (data.get("model") or "").strip() or folder.name

        desc_html = (data.get("description_html") or "").strip()
        desc_plain = (data.get("description") or "").strip()
        desc_file = folder / "description.txt"
        if desc_file.exists():
            desc_plain = desc_file.read_bytes().decode("utf-8-sig", errors="replace").strip() or desc_plain
        # 1. Начинаем с основного описания если есть
        description = desc_html if desc_html else desc_plain
        # 2. Добавляем атрибуты/характеристики из поля "attributes"
        attrs = data.get("attributes") or {}
        if attrs:
            attrs_text = "\n".join(f"{k}: {v}" for k, v in attrs.items())
            description = (description + "\n\n" + attrs_text).strip()
        # 3. Добавляем содержимое вкладок "tabs"
        tabs = data.get("tabs") or {}
        if tabs:
            tabs_text = "\n\n".join(
                f"{tab_name}:\n{tab_content}"
                for tab_name, tab_content in tabs.items()
                if tab_content and str(tab_content).strip()
            )
            if tabs_text:
                description = (description + "\n\n" + tabs_text).strip()
        # 4. Если описание всё ещё пустое — fallback из name + brand + model
        if not description.strip():
            parts = []
            brand_val = (data.get("brand") or data.get("manufacturer") or "").strip()
            name_val = (data.get("name") or "").strip() or name
            model_val = (data.get("model") or folder.name).strip()
            if name_val.startswith(model_val):
                name_val = name_val[len(model_val):].strip()
            if name_val:
                parts.append(name_val)
            if brand_val:
                parts.append(f"Производитель: {brand_val}")
            if model_val:
                parts.append(f"Модель: {model_val}")
            description = ". ".join(parts) if parts else (model_val or folder.name)
        # 5. Обрезаем до лимита SATU (12160 символов)
        description = description[:MAX_OPISANIE]

        image_names = data.get("images") or []
        image_paths = []
        for im in image_names:
            p = folder / im
            if p.exists():
                image_paths.append(p)
        if not image_paths:
            for f in sorted(folder.iterdir()):
                if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp") and f.name.startswith("image"):
                    image_paths.append(f)

        record = {"description": description, "image_paths": image_paths, "folder": folder.name}
        for key in (model, folder.name, get_clean_id(normalize_model_for_fs(model)), model_to_foldername(model)):
            if key and key not in result:
                result[key] = record
    return result


def load_products_for_satu(from_api: bool = True, limit: int | None = None) -> list:
    """
    Возвращает список товаров для выгрузки в SATU.
    При from_api=True: загрузка из B2B API, нормализация цен, скидки (price_manager),
    слияние с portal_export по model (описание, image_paths). Поля: name, model, brand, quantity,
    final_price, description, image_paths, folder.
    При from_api=False: загрузка только из portal_export (как load_products_from_portal),
    с подстановкой final_price из price_tenge и brand из product.json или "".
    """
    if from_api:
        from b2b_client import B2BClient
        from price_manager import calculate_final_price

        client = B2BClient()
        data = client.update_products(use_cache=True)
        api_products = data.get("products") or []
        if not api_products:
            return []

        portal_by_model = _build_portal_by_model()

        def lookup_portal(model: str):
            if not model:
                return {}
            model = model.strip()
            for key in (model, model_to_foldername(model), get_clean_id(normalize_model_for_fs(model))):
                if key and key in portal_by_model:
                    return portal_by_model[key]
            return {}

        out = []
        for p in api_products:
            price_rrc = _normalize_price_rrc(p)
            model = (p.get("model") or "").strip()
            brand = (p.get("brand") or "").strip()
            name_raw = (p.get("name") or "").strip()
            if model and name_raw.startswith(model):
                name = name_raw[len(model):].strip()
            else:
                name = name_raw
            quantity = max(0, int(p.get("quantity") or 0))

            portal = lookup_portal(model)
            # Если price_rrc нулевая/некорректная — пробуем взять цену из portal_export/product.json
            if not is_valid_price(price_rrc):
                portal_folder = portal.get("folder") or model
                portal_json = PORTAL_EXPORT_DIR / portal_folder / "product.json"
                if portal_json.exists():
                    try:
                        portal_data = json.loads(portal_json.read_bytes())
                        portal_price = float(portal_data.get("price") or 0)
                        if is_valid_price(portal_price):
                            price_rrc = portal_price
                    except Exception:
                        pass

            price_info = calculate_final_price(price_rrc, model, brand)
            final_price = float(price_info["final_price"])
            if not is_valid_price(final_price) and is_valid_price(price_rrc):
                final_price = price_rrc
            description = (portal.get("description") or "").strip()
            # Если описание пустое — собираем из полей B2B API
            if not description:
                parts = []
                if brand:
                    parts.append(f"Производитель: {brand}")
                if model:
                    parts.append(f"Модель: {model}")
                description = "\n".join(parts) if parts else (model or "")
            image_paths = portal.get("image_paths", [])
            folder = portal.get("folder", "")

            out.append({
                "name": name,
                "model": model,
                "brand": brand,
                "quantity": quantity,
                "price_rrc": price_rrc,
                "final_price": final_price,
                "description": description,
                "image_paths": image_paths,
                "folder": folder,
            })
            if limit is not None and len(out) >= limit:
                break
        return out

    # from_api=False: только portal_export
    portal_list = load_products_from_portal(limit=limit)
    from price_manager import calculate_final_price

    out = []
    for p in portal_list:
        model = (p.get("model") or "").strip()
        name = (p.get("name") or "").strip()
        brand = ""
        try:
            portal_dir = PORTAL_EXPORT_DIR / p.get("folder", "")
            if (portal_dir / "product.json").exists():
                data = json.loads((portal_dir / "product.json").read_bytes())
                brand = (data.get("brand") or data.get("manufacturer") or "").strip()
        except Exception:
            pass
        price_tenge = float(p.get("price_tenge") or 0)
        price_info = calculate_final_price(price_tenge, model, brand)
        final_price = float(price_info["final_price"])

        out.append({
            "name": name,
            "model": model,
            "brand": brand,
            "quantity": max(0, int(p.get("quantity", 1))),
            "price_rrc": price_tenge,
            "final_price": final_price,
            "description": p.get("description", ""),
            "image_paths": p.get("image_paths", []),
            "folder": p.get("folder", ""),
        })
    return out


def _search_queries_from_name(name: str, max_len: int = MAX_POISK_ZAPROS) -> str:
    """Формирует поисковые запросы из названия (обязательное поле SATU). Слова через запятую."""
    if not name:
        return "товар"
    words = re.findall(r"[а-яёa-z0-9\-]+", name.lower(), re.I)
    words = [w[:50] for w in words if len(w) >= 2][:15]
    s = ", ".join(words[:20])
    return s[:max_len] if s else "товар"


def _image_urls_for_product(product: dict, base_url: str) -> str:
    """Формирует строку URL изображений для SATU: «url1, url2». base_url — с завершающим слэшем (раздача по путям папка/файл)."""
    image_paths = product.get("image_paths") or []
    folder = (product.get("folder") or "").strip()
    if not base_url or not image_paths:
        return ""
    base = base_url.rstrip("/") + "/"
    parts = []
    for path in image_paths:
        name = path.name if hasattr(path, "name") else Path(path).name
        url = base + quote(folder) + "/" + quote(name)
        parts.append(url)
    return ", ".join(parts)


def _image_urls_via_api(product: dict, api_base_url: str) -> str:
    """Ссылки на изображения: https://grgroup.kz/catalog/api/products/{model}/image?index=0, ?index=1, ...
    api_base_url — базовый URL (напр. https://grgroup.kz)."""
    image_paths = product.get("image_paths") or []
    model = (product.get("model") or "").strip()
    if not api_base_url or not model or not image_paths:
        return ""
    base = api_base_url.rstrip("/")
    parts = []
    for i in range(len(image_paths)):
        url = f"{base}/catalog/api/products/{quote(model)}/image?index={i}"
        parts.append(url)
    return ", ".join(parts)


def build_full_excel(
    products: list,
    limit: int | None = None,
    image_base_url: str | None = None,
    image_via_api: bool = False,
    api_base_url: str | None = None,
):
    """Собирает Excel в формате SATU: Export Products Sheet + Export Groups Sheet.
    Ожидает в каждом товаре: name, model, brand, quantity, final_price, description, image_paths, folder.
    image_base_url: если задан, в Ссылка_изображения подставляются URL вида base_url/папка/файл.jpg
    image_via_api: если True, ссылки строятся на эндпоинт /api/products/{model}/image."""
    if limit:
        products = products[:limit]
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # --- Вкладка «Export Products Sheet» ---
    ws_products = wb.create_sheet("Export Products Sheet", 0)
    for col, h in enumerate(HEADERS_PRODUCTS, 1):
        c = ws_products.cell(row=1, column=col, value=h)
        c.font = openpyxl.styles.Font(bold=True)
    ws_products.row_dimensions[1].height = 20

    api_base = api_base_url or _get_api_base_url()
    col_w = [14, 40, 18, 50, 12, 12, 8, 10, 8, 10, 14, 12, 8, 50, 10, 28, 28]

    for row_idx, p in enumerate(products, 2):
        name = (p.get("name") or "")[:MAX_NAZVA]
        model = (p.get("model") or "")[:MAX_KOD_TOVARA]
        desc = (p.get("description") or "")[:MAX_OPISANIE]
        price = float(p.get("final_price") or 0)
        price_rrc = float(p.get("price_rrc") or 0)
        qty = max(0, int(p.get("quantity", 1)))
        brand = (p.get("brand") or "")[:MAX_PROIZVODITEL]
        search = _search_queries_from_name(name)

        if image_base_url:
            link_izobr = _image_urls_for_product(p, image_base_url)
        elif (image_via_api or api_base) and api_base and (p.get("image_paths") or []):
            link_izobr = _image_urls_via_api(p, api_base)
        else:
            link_izobr = ""

        ident = (p.get("model") or "")[:MAX_IDENTIFIKATOR]

        # Цена: некорректные (0, 0.01, >= 9M) — пустая ячейка (цена по запросу)
        price_value = price if is_valid_price(price) else None

        # Оптовая_цена: то же — только адекватные значения, иначе пусто
        opt_price_val = round(price_rrc, 2) if is_valid_price(price_rrc) else None

        # Минимальный_объем_заказа: SATU требует уникальное значение у каждой позиции — используем номер строки (2, 3, 4, …)
        min_order_unique = row_idx

        # Минимальный_заказ_опт: SATU — не может быть меньше 2
        min_order_opt_val = 2

        ws_products.cell(row=row_idx, column=1, value=model)
        ws_products.cell(row=row_idx, column=2, value=name)
        ws_products.cell(row=row_idx, column=3, value=search)
        ws_products.cell(row=row_idx, column=4, value=desc)
        ws_products.cell(row=row_idx, column=5, value="u")
        ws_products.cell(row=row_idx, column=6, value=price_value)
        ws_products.cell(row=row_idx, column=7, value="-")
        ws_products.cell(row=row_idx, column=8, value="KZT")
        ws_products.cell(row=row_idx, column=9, value="шт.")
        ws_products.cell(row=row_idx, column=10, value=min_order_unique)
        ws_products.cell(row=row_idx, column=11, value=opt_price_val)
        ws_products.cell(row=row_idx, column=12, value=min_order_opt_val)
        ws_products.cell(row=row_idx, column=13, value=qty)
        ws_products.cell(row=row_idx, column=14, value=link_izobr)
        ws_products.cell(row=row_idx, column=15, value="+" if qty > 0 else "-")
        ws_products.cell(row=row_idx, column=16, value=ident)
        ws_products.cell(row=row_idx, column=17, value=brand)

    for col, w in enumerate(col_w, 1):
        ws_products.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w

    # --- Вкладка «Export Groups Sheet» ---
    ws_groups = wb.create_sheet("Export Groups Sheet", 1)
    headers_groups = ["Номер_группы", "Название_группы", "Идентификатор_группы", "Номер_родителя", "Идентификатор_родителя"]
    for col, h in enumerate(headers_groups, 1):
        c = ws_groups.cell(row=1, column=col, value=h)
        c.font = openpyxl.styles.Font(bold=True)
    ws_groups.cell(row=2, column=1, value=1)
    ws_groups.cell(row=2, column=2, value="Товары")
    for col in range(3, 6):
        ws_groups.cell(row=2, column=col, value="")
    for col in range(1, 6):
        ws_groups.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 20

    return wb, len(products)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Собрать Excel в формате SATU (данные из API или portal_export)")
    parser.add_argument("-o", "--output", type=Path, default=_apisite_dir / "satu_import_full.xlsx", help="Путь к .xlsx")
    parser.add_argument("--limit", type=int, default=None, help="Максимум товаров")
    parser.add_argument(
        "--from-api",
        action="store_true",
        default=True,
        help="Брать товары из B2B API и слияние с portal_export (по умолчанию).",
    )
    parser.add_argument(
        "--no-from-api",
        action="store_false",
        dest="from_api",
        help="Брать товары только из portal_export.",
    )
    parser.add_argument(
        "--image-via-api",
        action="store_true",
        help="Ссылки на фото через API apisite (GET /api/products/модель/image). Используется SITEMAP_BASE_URL из .env (напр. https://grgroup.kz).",
    )
    parser.add_argument(
        "--api-base-url",
        type=str,
        default=None,
        help="Базовый URL API (если не задан, берётся SITEMAP_BASE_URL из config). Нужен для --image-via-api при другом домене.",
    )
    parser.add_argument(
        "--image-base-url",
        type=str,
        default=None,
        help="Базовый URL раздачи по путям папка/файл (напр. https://site.com/catalog/). Загрузите папки portal_export по этому адресу.",
    )
    args = parser.parse_args()

    products = load_products_for_satu(from_api=args.from_api, limit=args.limit)
    if not products:
        msg = "Товары не найдены в API/кэше." if args.from_api else "Товары не найдены в portal_export."
        print(msg)
        sys.exit(1)
    wb, count = build_full_excel(
        products,
        limit=args.limit,
        image_base_url=args.image_base_url,
        image_via_api=args.image_via_api,
        api_base_url=args.api_base_url,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    wb.save(args.output)
    print(f"Готово: {count} позиций сохранено в {args.output}")


if __name__ == "__main__":
    main()
