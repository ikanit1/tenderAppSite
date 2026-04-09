# Satu XLSX Export: характеристики, фото, SEO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в Satu XLSX экспорт характеристики товаров, автозагрузку фото с complex.com.kz, SEO-поля и страну производителя.

**Architecture:** Все изменения в одном файле `export_satu_excel.py`. Pipeline: `_build_portal_by_model()` прокидывает `attributes` → `load_products_for_satu()` передаёт дальше → `build_full_excel()` формирует динамические столбцы характеристик, SEO-поля и страну. Перед сборкой Excel вызывается `ensure_product_images()` для скачивания недостающих фото.

**Tech Stack:** Python 3.13, openpyxl, urllib.request, re, html.parser

**Spec:** `docs/superpowers/specs/2026-04-10-satu-export-characteristics-images-design.md`

---

### Task 1: Пробросить attributes через pipeline данных

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py:123-344`

- [ ] **Step 1: Добавить attributes в record внутри `_build_portal_by_model()` (проход 1 — product.json)**

В функции `_build_portal_by_model()`, строка ~177, переменная `attrs` уже вычисляется. Нужно передать её в record.

Найти строку:
```python
        record = {"description": description, "image_paths": image_paths, "folder": folder.name}
```
(строка ~193) и заменить на:
```python
        record = {"description": description, "image_paths": image_paths, "folder": folder.name, "attributes": attrs}
```

Где `attrs` — это `data.get("attributes") or {}` (уже вычислено выше в той же функции, строка ~177).

- [ ] **Step 2: Добавить attributes в record внутри `_build_portal_by_model()` (проход 2 — info.json)**

Для прохода 2 (info.json, строка ~196-226) attrs не вычисляется. Нужно добавить его.

Найти строку:
```python
        record = {"description": description, "image_paths": image_paths, "folder": folder.name}
```
(строка ~224) и заменить на:
```python
        attrs = data.get("attributes") or {}
        record = {"description": description, "image_paths": image_paths, "folder": folder.name, "attributes": attrs}
```

- [ ] **Step 3: Пробросить attributes в `load_products_for_satu()` (ветка from_api=True)**

В блоке `out.append({...})` (строка ~297-307) добавить поле:

Найти:
```python
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
```
Заменить на:
```python
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
                "attributes": portal.get("attributes", {}),
            })
```

- [ ] **Step 4: Пробросить attributes в `load_products_for_satu()` (ветка from_api=False)**

В блоке `out.append({...})` (строка ~332-343) добавить чтение attributes из product.json и передачу.

Найти:
```python
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
```
Заменить на:
```python
        attrs = {}
        try:
            portal_dir = PORTAL_EXPORT_DIR / p.get("folder", "")
            if (portal_dir / "product.json").exists():
                pdata = json.loads((portal_dir / "product.json").read_bytes())
                attrs = pdata.get("attributes") or {}
        except Exception:
            pass
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
            "attributes": attrs,
        })
```

Примечание: чтение product.json здесь уже происходит чуть выше для brand — можно объединить. Но в этом блоке `data` уже недоступна (другой scope), поэтому читаем заново в `pdata`.

- [ ] **Step 5: Коммит**

```bash
git add tenderbot/apisite/export_satu_excel.py
git commit -m "feat(satu): pass product attributes through export pipeline"
```

---

### Task 2: Парсер характеристик и вспомогательные функции

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py` (добавить функции после строки ~54, блок констант)

- [ ] **Step 1: Добавить blacklist и whitelist констант**

После строки `MAX_IDENTIFIKATOR = 255` (строка ~53) добавить:

```python
# Характеристики: blacklist ключей (не являются характеристиками товара)
_ATTRS_BLACKLIST = {"Итого", "Код Elevel"}

# Whitelist единиц измерения для парсинга значений характеристик
# Порядок важен: сначала длинные (мм² перед мм, кВт перед Вт)
_UNIT_PATTERN = re.compile(
    r"\s+(мм²|мм|см|м|км|мкм|г|кг|т|шт|кВт|МВт|Вт|кГц|МГц|Гц|°C|°|кОм|МОм|Ом|мкФ|нФ|пФ|Ф|Гн|лм|лк|кПа|МПа|Па|бар|дБ|мл|л|А|В)$"
)

MAX_SEO_TITLE = 250
MAX_SEO_DESC = 250
```

- [ ] **Step 2: Добавить функцию `_parse_attr_value()`**

После блока констант добавить:

```python
def _parse_attr_value(raw_value: str) -> tuple[str, str]:
    """Разделяет значение характеристики на (значение, единица_измерения).

    Примеры:
        '44.5 мм' → ('44.5', 'мм')
        'Да' → ('Да', '')
        '4 А' → ('4', 'А')
        '1.0...25.0 мм²' → ('1.0...25.0', 'мм²')
        '-20…+55' → ('-20…+55', '')
    """
    raw_value = raw_value.strip()
    if not raw_value:
        return ("", "")
    m = _UNIT_PATTERN.search(raw_value)
    if m:
        unit = m.group(1)
        value = raw_value[:m.start()].strip()
        return (value, unit)
    return (raw_value, "")
```

- [ ] **Step 3: Добавить функцию `_filter_attributes()`**

```python
def _filter_attributes(attrs: dict) -> list[tuple[str, str, str]]:
    """Фильтрует и парсит attributes dict в список (название, измерение, значение).

    Убирает ключи из blacklist, парсит единицы измерения.
    """
    result = []
    for key, value in attrs.items():
        if key in _ATTRS_BLACKLIST:
            continue
        val_str = str(value).strip() if value else ""
        if not val_str:
            continue
        parsed_value, unit = _parse_attr_value(val_str)
        result.append((key, unit, parsed_value))
    return result
```

- [ ] **Step 4: Добавить SEO-функции**

```python
def _strip_html_tags(html_str: str) -> str:
    """Удаляет все HTML-теги из строки."""
    return re.sub(r"<[^>]+>", " ", html_str).strip()


def _build_seo_title(name: str, max_len: int = MAX_SEO_TITLE) -> str:
    """Генерирует HTML_заголовок для SEO.

    Шаблон: '{Название} — Купить в Астане по выгодной цене | G&R Group'
    """
    suffix = " — Купить в Астане по выгодной цене | G&R Group"
    if len(name) + len(suffix) <= max_len:
        return name + suffix
    # Обрезаем название, сохраняя суффикс
    available = max_len - len(suffix)
    truncated = name[:available].rsplit(" ", 1)[0] if available > 10 else name[:available]
    return truncated + suffix


def _build_seo_description(description: str, max_len: int = MAX_SEO_DESC) -> str:
    """Генерирует HTML_описание для SEO.

    Шаблон: '{первые ~150 символов без HTML}. Купить в Астане с доставкой. G&R Group'
    """
    suffix = ". Купить в Астане с доставкой. G&R Group"
    plain = _strip_html_tags(description)
    # Убираем лишние пробелы
    plain = re.sub(r"\s+", " ", plain).strip()
    available = max_len - len(suffix)
    if available <= 0:
        return suffix.lstrip(". ")
    if len(plain) > available:
        plain = plain[:available].rsplit(" ", 1)[0]
    if not plain:
        return "Купить в Астане с доставкой. G&R Group"
    return plain + suffix
```

- [ ] **Step 5: Добавить функцию `_extract_country()`**

```python
_COUNTRY_KEYS = ("Страна", "Страна производства", "Страна-производитель", "Страна производитель", "Country")


def _extract_country(attrs: dict) -> str:
    """Извлекает страну производителя из attributes."""
    for key in _COUNTRY_KEYS:
        if key in attrs:
            return str(attrs[key]).strip()
    # Поиск без учёта регистра
    lower_map = {k.lower(): v for k, v in attrs.items()}
    for key in _COUNTRY_KEYS:
        if key.lower() in lower_map:
            return str(lower_map[key.lower()]).strip()
    return ""
```

- [ ] **Step 6: Проверить парсер вручную**

Запустить:
```bash
cd tenderbot/apisite && python -c "
from export_satu_excel import _parse_attr_value, _filter_attributes, _build_seo_title, _build_seo_description, _extract_country
# Тест парсера
assert _parse_attr_value('44.5 мм') == ('44.5', 'мм'), _parse_attr_value('44.5 мм')
assert _parse_attr_value('Да') == ('Да', ''), _parse_attr_value('Да')
assert _parse_attr_value('4 А') == ('4', 'А'), _parse_attr_value('4 А')
assert _parse_attr_value('1.0...25.0 мм²') == ('1.0...25.0', 'мм²'), _parse_attr_value('1.0...25.0 мм²')
assert _parse_attr_value('-20…+55') == ('-20…+55', ''), _parse_attr_value('-20…+55')
# Тест фильтрации
attrs = {'Итого': '140100', 'Производитель': 'Dahua', 'Масса, кг': '0.215'}
result = _filter_attributes(attrs)
assert len(result) == 2, result
assert result[0] == ('Производитель', '', 'Dahua'), result[0]
# Тест SEO
title = _build_seo_title('Контактор A9C20732')
assert 'Астане' in title and 'G&R Group' in title, title
desc = _build_seo_description('<h3>Контактор</h3><ul><li>Мощный</li></ul>')
assert 'Контактор' in desc and 'Астане' in desc, desc
# Тест страны
assert _extract_country({'Страна производства': 'Китай'}) == 'Китай'
assert _extract_country({'Серия': 'ACTI9'}) == ''
print('All tests passed!')
"
```
Expected: `All tests passed!`

- [ ] **Step 7: Коммит**

```bash
git add tenderbot/apisite/export_satu_excel.py
git commit -m "feat(satu): add attribute parser, SEO builders, and country extractor"
```

---

### Task 3: Функция загрузки фото с complex.com.kz

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py` (добавить функцию после `_extract_country`)

- [ ] **Step 1: Добавить импорт `time` в начало файла**

Найти строку:
```python
from pathlib import Path
```
Заменить на:
```python
import time
from pathlib import Path
```

- [ ] **Step 2: Добавить функцию `ensure_product_images()`**

```python
_SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

_IMG_ACCEPT = {
    "User-Agent": _SCRAPE_HEADERS["User-Agent"],
    "Accept": "image/webp,image/png,image/jpeg,*/*;q=0.8",
}


def _get_original_image_url(cache_url: str) -> str:
    """Преобразует URL кеша complex.com.kz в оригинал.

    '/image/cache/catalog/.../main-360x360.jpg' → '/image/catalog/.../main.jpg'
    """
    url = cache_url.replace("/cache/", "/")
    # Убираем суффикс размера: -NNNxNNN перед расширением
    url = re.sub(r"-\d+x\d+(\.\w+)$", r"\1", url)
    return url


def ensure_product_images(portal_export_dir: Path, max_products: int | None = None) -> dict[str, int]:
    """Скачивает фото с complex.com.kz для товаров без изображений.

    Возвращает статистику: {'checked': N, 'downloaded': N, 'failed': N, 'skipped': N}
    """
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError

    stats = {"checked": 0, "downloaded": 0, "failed": 0, "skipped": 0}
    if not portal_export_dir.is_dir():
        return stats

    folders = sorted(f for f in portal_export_dir.iterdir() if f.is_dir())
    if max_products:
        folders = folders[:max_products]

    for folder in folders:
        product_json = folder / "product.json"
        if not product_json.exists():
            continue

        # Проверяем наличие image-файлов
        existing_images = [
            f for f in folder.iterdir()
            if f.is_file() and f.name.startswith("image") and f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
        ]
        if existing_images:
            stats["skipped"] += 1
            continue

        stats["checked"] += 1

        try:
            data = json.loads(product_json.read_bytes())
        except Exception:
            stats["failed"] += 1
            continue

        product_url = (data.get("product_url") or "").strip()
        if not product_url:
            stats["failed"] += 1
            continue

        try:
            req = Request(product_url, headers=_SCRAPE_HEADERS)
            resp = urlopen(req, timeout=15)
            html = resp.read().decode("utf-8", errors="replace")
        except (URLError, HTTPError, OSError) as e:
            print(f"  [WARN] HTTP error for {folder.name}: {e}", file=sys.stderr)
            stats["failed"] += 1
            continue

        # Ищем изображения в секции oct-gallery (основное фото + галерея)
        image_urls = re.findall(
            r'oct-gallery[^>]*href=["\']([^"\']+)["\']', html
        )
        if not image_urls:
            # Фоллбэк: ищем img src в productImages секции
            idx = html.find("productImages")
            if idx >= 0:
                section = html[idx:idx + 5000]
                image_urls = re.findall(
                    r'src=["\'](https?://complex\.com\.kz/image/[^"\']+\.(?:jpg|jpeg|png|webp))["\']',
                    section, re.I
                )

        # Дедупликация и фильтрация (убираем логотипы, иконки, заглушки)
        seen = set()
        clean_urls = []
        for url in image_urls:
            if not url.startswith("http"):
                url = "https://complex.com.kz" + url
            # Пропускаем явно не-товарные изображения
            if any(x in url.lower() for x in ("logo", "icon", "new-icon", "shipproduct", "distributor")):
                continue
            # Пропускаем URL-директории (без расширения файла)
            if not re.search(r"\.\w{3,4}$", url):
                continue
            orig = _get_original_image_url(url)
            if orig not in seen:
                seen.add(orig)
                clean_urls.append(orig)

        if not clean_urls:
            stats["failed"] += 1
            continue

        # Скачиваем (макс. 10 фото)
        downloaded_names = []
        for i, img_url in enumerate(clean_urls[:10], 1):
            ext = Path(img_url).suffix.lower() or ".jpg"
            if ext not in (".jpg", ".jpeg", ".png", ".webp"):
                ext = ".jpg"
            filename = f"image_{i:02d}{ext}"
            try:
                req = Request(img_url, headers=_IMG_ACCEPT)
                img_resp = urlopen(req, timeout=15)
                img_data = img_resp.read()
                if len(img_data) < 500:  # Слишком маленький — вероятно, заглушка
                    continue
                (folder / filename).write_bytes(img_data)
                downloaded_names.append(filename)
            except (URLError, HTTPError, OSError) as e:
                print(f"  [WARN] Failed to download image {img_url}: {e}", file=sys.stderr)
                continue

        if downloaded_names:
            # Обновляем product.json
            data["images"] = downloaded_names
            data["images_count"] = len(downloaded_names)
            product_json.write_bytes(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
            stats["downloaded"] += 1
            print(f"  [OK] {folder.name}: downloaded {len(downloaded_names)} images")
        else:
            stats["failed"] += 1

        time.sleep(0.5)  # Пауза между запросами

    return stats
```

- [ ] **Step 3: Проверить на реальных данных**

```bash
cd tenderbot/apisite && python -c "
from pathlib import Path
from export_satu_excel import ensure_product_images
stats = ensure_product_images(Path('portal_export'), max_products=50)
print(f'Stats: {stats}')
"
```
Expected: `skipped` ≈ 49-50, `downloaded` + `failed` ≈ 0-1 (почти все папки уже имеют фото).

- [ ] **Step 4: Коммит**

```bash
git add tenderbot/apisite/export_satu_excel.py
git commit -m "feat(satu): add ensure_product_images() to download missing photos from complex.com.kz"
```

---

### Task 4: Обновить HEADERS и build_full_excel()

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py:56-563`

- [ ] **Step 1: Обновить HEADERS_PRODUCTS**

Найти:
```python
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
    "Номер_группы",
    "Название_группы",
)
```
Заменить на:
```python
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
    "Страна_производитель",
    "HTML_заголовок",
    "HTML_описание",
    "Номер_группы",
    "Название_группы",
)
```

- [ ] **Step 2: Обновить build_full_excel() — вычислить max_attrs и записать заголовки**

Найти начало функции `build_full_excel` — блок:
```python
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # --- Вкладка «Export Products Sheet» ---
    ws_products = wb.create_sheet("Export Products Sheet", 0)
    for col, h in enumerate(HEADERS_PRODUCTS, 1):
        c = ws_products.cell(row=1, column=col, value=h)
        c.font = openpyxl.styles.Font(bold=True)
    ws_products.row_dimensions[1].height = 20
```

Заменить на:
```python
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # --- Подготовка характеристик: определяем макс. кол-во блоков ---
    max_attrs = 0
    for p in products:
        attrs = p.get("attributes") or {}
        filtered = [k for k in attrs if k not in _ATTRS_BLACKLIST and str(attrs[k]).strip()]
        if len(filtered) > max_attrs:
            max_attrs = len(filtered)

    # --- Вкладка «Export Products Sheet» ---
    ws_products = wb.create_sheet("Export Products Sheet", 0)
    # Основные заголовки
    for col, h in enumerate(HEADERS_PRODUCTS, 1):
        c = ws_products.cell(row=1, column=col, value=h)
        c.font = openpyxl.styles.Font(bold=True)
    # Заголовки характеристик (блоки по 3 столбца)
    base_col = len(HEADERS_PRODUCTS) + 1
    for i in range(max_attrs):
        for j, suffix in enumerate(("Название_Характеристики", "Измерение_Характеристики", "Значение_Характеристики")):
            col_idx = base_col + i * 3 + j
            c = ws_products.cell(row=1, column=col_idx, value=suffix)
            c.font = openpyxl.styles.Font(bold=True)
    ws_products.row_dimensions[1].height = 20
```

- [ ] **Step 3: Обновить build_full_excel() — записать данные товаров**

Найти блок записи данных (строки ~480-544):
```python
    api_base = api_base_url or _get_api_base_url()
    col_w = [14, 40, 18, 50, 12, 12, 8, 10, 8, 10, 14, 12, 8, 50, 10, 28, 28, 12, 30]

    seen_identifiers = {}  # Для дедупликации идентификаторов товара

    for row_idx, p in enumerate(products, 2):
        name = (p.get("name") or "")[:MAX_NAZVA]
        model = (p.get("model") or "")[:MAX_KOD_TOVARA]
        desc = (p.get("description") or "")[:MAX_OPISANIE]
        price = float(p.get("final_price") or 0)
        price_rrc = float(p.get("price_rrc") or 0)
        qty = max(0, int(p.get("quantity", 1)))
        brand = (p.get("brand") or "")[:MAX_PROIZVODITEL]
        category = classify_product(model, name)
        search = _build_search_queries(name, brand, category)

        if image_base_url:
            link_izobr = _image_urls_for_product(p, image_base_url)
        elif api_base and (p.get("image_paths") or []):
            link_izobr = _image_urls_via_api(p, api_base)
        else:
            link_izobr = ""

        # Идентификатор_товара: дедупликация для вариантов одной модели (MVA31-* и др.)
        base_ident = (p.get("model") or "")[:MAX_IDENTIFIKATOR]
        if base_ident in seen_identifiers:
            seen_identifiers[base_ident] += 1
            ident = f"{base_ident}_{seen_identifiers[base_ident]}"[:MAX_IDENTIFIKATOR]
        else:
            seen_identifiers[base_ident] = 1
            ident = base_ident

        # Цена: розничная (final_price со скидкой)
        price_value = price if is_valid_price(price) else None

        # Оптовая_цена: должна быть ≤ розничной (SATU валидация)
        # Логика: оптовая = розничная * 0.85 (скидка 15% для опта), но не больше розничной
        if is_valid_price(price):
            opt_price_val = round(price * 0.85, 2)
            # Проверка: оптовая не может быть больше розничной
            if opt_price_val > price:
                opt_price_val = price
        else:
            opt_price_val = None

        # Минимальный_объем_заказа: константа 1 (SATU требует уникальность, но 1 подходит для всех)
        min_order_unique = 1

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
        ws_products.cell(row=row_idx, column=18, value=get_group_number(category))
        ws_products.cell(row=row_idx, column=19, value=category)

    for col, w in enumerate(col_w, 1):
        ws_products.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w
```

Заменить на:
```python
    api_base = api_base_url or _get_api_base_url()
    col_w = [14, 40, 18, 50, 12, 12, 8, 10, 8, 10, 14, 12, 8, 50, 10, 28, 28, 20, 40, 40, 12, 30]

    seen_identifiers = {}  # Для дедупликации идентификаторов товара

    for row_idx, p in enumerate(products, 2):
        name = (p.get("name") or "")[:MAX_NAZVA]
        model = (p.get("model") or "")[:MAX_KOD_TOVARA]
        desc = (p.get("description") or "")[:MAX_OPISANIE]
        price = float(p.get("final_price") or 0)
        price_rrc = float(p.get("price_rrc") or 0)
        qty = max(0, int(p.get("quantity", 1)))
        brand = (p.get("brand") or "")[:MAX_PROIZVODITEL]
        category = classify_product(model, name)
        search = _build_search_queries(name, brand, category)
        attrs_raw = p.get("attributes") or {}

        if image_base_url:
            link_izobr = _image_urls_for_product(p, image_base_url)
        elif api_base and (p.get("image_paths") or []):
            link_izobr = _image_urls_via_api(p, api_base)
        else:
            link_izobr = ""

        # Идентификатор_товара: дедупликация для вариантов одной модели (MVA31-* и др.)
        base_ident = (p.get("model") or "")[:MAX_IDENTIFIKATOR]
        if base_ident in seen_identifiers:
            seen_identifiers[base_ident] += 1
            ident = f"{base_ident}_{seen_identifiers[base_ident]}"[:MAX_IDENTIFIKATOR]
        else:
            seen_identifiers[base_ident] = 1
            ident = base_ident

        # Цена: розничная (final_price со скидкой)
        price_value = price if is_valid_price(price) else None

        # Оптовая_цена: должна быть ≤ розничной (SATU валидация)
        if is_valid_price(price):
            opt_price_val = round(price * 0.85, 2)
            if opt_price_val > price:
                opt_price_val = price
        else:
            opt_price_val = None

        min_order_unique = 1
        min_order_opt_val = 2

        # SEO и страна
        country = _extract_country(attrs_raw)
        seo_title = _build_seo_title(name)
        seo_desc = _build_seo_description(desc)

        # Основные столбцы (22)
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
        ws_products.cell(row=row_idx, column=18, value=country)
        ws_products.cell(row=row_idx, column=19, value=seo_title)
        ws_products.cell(row=row_idx, column=20, value=seo_desc)
        ws_products.cell(row=row_idx, column=21, value=get_group_number(category))
        ws_products.cell(row=row_idx, column=22, value=category)

        # Характеристики (динамические столбцы)
        parsed_attrs = _filter_attributes(attrs_raw)
        base_col = len(HEADERS_PRODUCTS) + 1
        for attr_idx, (attr_name, attr_unit, attr_value) in enumerate(parsed_attrs):
            col_offset = base_col + attr_idx * 3
            ws_products.cell(row=row_idx, column=col_offset, value=attr_name)
            ws_products.cell(row=row_idx, column=col_offset + 1, value=attr_unit)
            ws_products.cell(row=row_idx, column=col_offset + 2, value=attr_value)

    for col, w in enumerate(col_w, 1):
        ws_products.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w
    # Ширина столбцов характеристик
    base_col = len(HEADERS_PRODUCTS) + 1
    for i in range(max_attrs):
        ws_products.column_dimensions[openpyxl.utils.get_column_letter(base_col + i * 3)].width = 30
        ws_products.column_dimensions[openpyxl.utils.get_column_letter(base_col + i * 3 + 1)].width = 12
        ws_products.column_dimensions[openpyxl.utils.get_column_letter(base_col + i * 3 + 2)].width = 25
```

- [ ] **Step 4: Коммит**

```bash
git add tenderbot/apisite/export_satu_excel.py
git commit -m "feat(satu): add SEO fields, country, and dynamic attribute columns to XLSX export"
```

---

### Task 5: Интеграция ensure_product_images в main() и FastAPI endpoint

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py:566-621`
- Modify: `tenderbot/apisite/main.py:2046` (FastAPI endpoint)

- [ ] **Step 1: Добавить вызов ensure_product_images в main()**

Найти в `main()`:
```python
    products = load_products_for_satu(from_api=args.from_api, limit=args.limit)
    if not products:
```

Заменить на:
```python
    # Загружаем недостающие фото перед экспортом
    print("Проверяем наличие фото товаров...")
    img_stats = ensure_product_images(PORTAL_EXPORT_DIR)
    print(f"Фото: проверено={img_stats['checked']}, загружено={img_stats['downloaded']}, "
          f"пропущено={img_stats['skipped']}, ошибок={img_stats['failed']}")

    products = load_products_for_satu(from_api=args.from_api, limit=args.limit)
    if not products:
```

- [ ] **Step 2: Добавить CLI-флаг --skip-images**

В блоке `argparse` (после последнего `parser.add_argument`) добавить:

```python
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Пропустить загрузку недостающих фото с complex.com.kz.",
    )
```

И обновить вызов — заменить блок:
```python
    # Загружаем недостающие фото перед экспортом
    print("Проверяем наличие фото товаров...")
    img_stats = ensure_product_images(PORTAL_EXPORT_DIR)
    print(f"Фото: проверено={img_stats['checked']}, загружено={img_stats['downloaded']}, "
          f"пропущено={img_stats['skipped']}, ошибок={img_stats['failed']}")
```
На:
```python
    if not args.skip_images:
        print("Проверяем наличие фото товаров...")
        img_stats = ensure_product_images(PORTAL_EXPORT_DIR)
        print(f"Фото: проверено={img_stats['checked']}, загружено={img_stats['downloaded']}, "
              f"пропущено={img_stats['skipped']}, ошибок={img_stats['failed']}")
```

- [ ] **Step 3: Обновить FastAPI endpoint в main.py**

Прочитать `main.py` вокруг строки 2046, найти endpoint `download_satu_excel` и добавить вызов ensure_product_images перед load_products_for_satu.

Найти в main.py:
```python
@app.get("/api/admin/satu/export-excel")
def download_satu_excel(request: Request):
```

Внутри этой функции, перед вызовом `load_products_for_satu`, добавить:
```python
    from export_satu_excel import ensure_product_images
    ensure_product_images(PORTAL_EXPORT_DIR)
```

(Точное размещение зависит от текущей структуры endpoint — нужно прочитать и адаптировать.)

- [ ] **Step 4: Тест полного экспорта (ограниченный)**

```bash
cd tenderbot/apisite && python export_satu_excel.py --skip-images --limit 50 --no-from-api -o /tmp/test_satu.xlsx
```

Затем проверить файл:
```bash
python -c "
import openpyxl
wb = openpyxl.load_workbook('/tmp/test_satu.xlsx')
ws = wb['Export Products Sheet']
headers = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]
print(f'Total columns: {ws.max_column}')
print(f'Total rows: {ws.max_row}')
print(f'Headers: {headers[:25]}')
# Check a row with attributes
for row in range(2, min(10, ws.max_row + 1)):
    name = ws.cell(row, 2).value
    seo = ws.cell(row, 19).value
    attr_col = 23
    attr_name = ws.cell(row, attr_col).value
    print(f'  Row {row}: name={name[:30] if name else \"\"}, seo_title={seo[:40] if seo else \"\"}, first_attr={attr_name}')
"
```
Expected: 22 основных столбцов + динамические характеристики. SEO-заголовки содержат "Астане" и "G&R Group".

- [ ] **Step 5: Коммит**

```bash
git add tenderbot/apisite/export_satu_excel.py tenderbot/apisite/main.py
git commit -m "feat(satu): integrate image downloader into CLI and FastAPI, add --skip-images flag"
```

---

### Task 6: Финальная верификация

- [ ] **Step 1: Полный экспорт с реальными данными (без API, чтобы не зависеть от B2B)**

```bash
cd tenderbot/apisite && python export_satu_excel.py --skip-images --no-from-api -o satu_import_full.xlsx
```

Expected: `Готово: NNNN позиций сохранено в satu_import_full.xlsx`

- [ ] **Step 2: Валидация структуры файла**

```bash
cd tenderbot/apisite && python -c "
import openpyxl
wb = openpyxl.load_workbook('satu_import_full.xlsx')

# Products sheet
ws = wb['Export Products Sheet']
print(f'=== Export Products Sheet ===')
print(f'Columns: {ws.max_column}')
print(f'Rows: {ws.max_row}')

# Verify headers
h = [ws.cell(1, c).value for c in range(1, min(ws.max_column + 1, 30))]
print(f'First 29 headers: {h}')

# Verify SEO
seo_ok = 0
for r in range(2, ws.max_row + 1):
    title = ws.cell(r, 19).value or ''
    if 'G&R Group' in title:
        seo_ok += 1
print(f'SEO titles with G&R Group: {seo_ok}/{ws.max_row - 1}')

# Verify attributes present
attrs_ok = 0
for r in range(2, ws.max_row + 1):
    if ws.cell(r, 23).value:
        attrs_ok += 1
print(f'Products with attributes: {attrs_ok}/{ws.max_row - 1}')

# Groups sheet
ws2 = wb['Export Groups Sheet']
print(f'\\n=== Export Groups Sheet ===')
print(f'Groups: {ws2.max_row - 1}')
"
```

Expected:
- 22 + N*3 столбцов
- SEO titles: все содержат "G&R Group"
- Products with attributes: ~877+ (из 6205)
- Groups: 36

- [ ] **Step 3: Финальный коммит (если были мелкие правки)**

```bash
git add tenderbot/apisite/export_satu_excel.py
git commit -m "fix(satu): final adjustments to XLSX export"
```
