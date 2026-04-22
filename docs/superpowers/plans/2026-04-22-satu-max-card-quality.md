# Satu: максимальное заполнение карточек — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заполнить все возможные колонки формата импорта Satu.kz: 6 новых колонок в Products Sheet, улучшить описания товаров с attributes, усилить поисковые запросы, добавить SEO для групп.

**Architecture:** Два файла: `satu_categories.py` получает новые словари и геттеры; `export_satu_excel.py` получает новую функцию описания, расширенные заголовки (22→28), заполнение новых колонок, новую функцию поиска и 3 новые колонки в Groups Sheet. Никаких новых файлов — только правки в существующих.

**Tech Stack:** Python 3.11+, openpyxl, без внешних зависимостей.

---

## Файлы

| Файл | Действие | Что меняем |
|------|----------|-----------|
| `tenderbot/apisite/satu_categories.py` | Modify | Добавить `SATU_CATEGORY_URLS`, `SUPPLY_VOLUMES`, `SUPPLY_PERIOD`, `DEFAULT_SUPPLY_VOLUME`, `get_satu_category_url()`, `get_supply_volume()` |
| `tenderbot/apisite/export_satu_excel.py` | Modify | Новая функция `_build_description_from_attrs()`, расширить `_build_search_queries()`, обновить `HEADERS_PRODUCTS`, заполнить 6 новых колонок и Groups SEO в `build_full_excel()` |
| `tenderbot/apisite/test_satu_export.py` | Create | Юнит-тесты для новых функций |

---

## Task 1: Добавить словари и геттеры в satu_categories.py

**Files:**
- Modify: `tenderbot/apisite/satu_categories.py`
- Create: `tenderbot/apisite/test_satu_export.py`

- [ ] **Step 1: Добавить словари и геттеры в конец satu_categories.py**

Открыть `tenderbot/apisite/satu_categories.py`. В конец файла (после `get_group_number()`) добавить:

```python
# URL категорий на Satu.kz (проверено на satu.kz 2026-04-22)
SATU_CATEGORY_URLS: dict[str, str] = {
    "Видеокамеры":                    "https://satu.kz/Elektrooborudovanie",
    "Видеорегистраторы":              "https://satu.kz/Elektrooborudovanie",
    "Коммутаторы":                    "https://satu.kz/Kommutatory",
    "Точки доступа и маршрутизаторы": "https://satu.kz/Routeryi",
    "Мониторы и дисплеи":             "https://satu.kz/Monitory",
    "Жёсткие диски":                  "https://satu.kz/Zhestkie-diski",
    "Кронштейны и крепёж":            "https://satu.kz/Krepezhnye-materialy",
    "Контроль доступа (СКУД)":        "https://satu.kz/Elektrooborudovanie",
    "Аудио и видеотехника":           "https://satu.kz/Akusticheskie-sistemy",
    "Кабель и провод":                "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Кабельные каналы":               "https://satu.kz/Korobki-montazhnye",
    "Лотки и аксессуары лотков":      "https://satu.kz/Korobki-montazhnye",
    "Автоматические выключатели":     "https://satu.kz/Vyklyuchateli",
    "Дифференциальная защита":        "https://satu.kz/Rele",
    "Контакторы и пускатели":         "https://satu.kz/Kontaktory",
    "Светодиодные лампы":             "https://satu.kz/Lampochki",
    "Светильники и прожекторы":       "https://satu.kz/Led-osveschenie",
    "Светодиодные ленты":             "https://satu.kz/Led-osveschenie",
    "Наконечники и гильзы":           "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Розетки и выключатели":          "https://satu.kz/Rozetki-elektricheskie",
    "Датчики":                        "https://satu.kz/Datchiki",
    "Реле":                           "https://satu.kz/Rele",
    "Электродвигатели":               "https://satu.kz/Servodvigateli",
    "Шкафы и щиты":                   "https://satu.kz/Raspredelitelnye-schity",
    "Трансформаторы":                 "https://satu.kz/Transformatory",
    "Разъемы и коннекторы":           "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Блоки питания":                  "https://satu.kz/Bloki-pitaniya",
    "Зажимы и клеммы":                "https://satu.kz/Krepezhnye-materialy",
    "Монтажные коробки":              "https://satu.kz/Korobki-montazhnye",
    "Частотные преобразователи":      "https://satu.kz/Preobrazovateli-chastoty",
    "Муфты и трубы":                  "https://satu.kz/Provod-kabel-sistemy-soedineniya",
    "Устройства плавного пуска":      "https://satu.kz/Ustrojstva-plavnogo-puska",
    "Кнопки управления":              "https://satu.kz/Vyklyuchateli",
    "Патроны и стартёры":             "https://satu.kz/Komplektuyuschie-dlya-svetovyh-priborov",
    "Счётчики электроэнергии":        "https://satu.kz/Schetchiki-elektroenergii",
    "Прочее":                         "https://satu.kz/Elektrooborudovanie",
}

# Объём поставки по категориям (единица/месяц)
SUPPLY_VOLUMES: dict[str, int] = {
    "Кабель и провод":            1000,
    "Кабельные каналы":           500,
    "Лотки и аксессуары лотков":  200,
}
SUPPLY_PERIOD = "месяц"
DEFAULT_SUPPLY_VOLUME = 100


def get_satu_category_url(category: str) -> str:
    """Возвращает URL категории на satu.kz."""
    return SATU_CATEGORY_URLS.get(category, SATU_CATEGORY_URLS["Прочее"])


def get_supply_volume(category: str) -> int:
    """Возвращает объём поставки для категории."""
    return SUPPLY_VOLUMES.get(category, DEFAULT_SUPPLY_VOLUME)
```

- [ ] **Step 2: Создать тестовый файл test_satu_export.py**

Создать `tenderbot/apisite/test_satu_export.py`:

```python
"""Юнит-тесты для satu_categories и export_satu_excel."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from satu_categories import (
    get_satu_category_url, get_supply_volume,
    SATU_CATEGORY_URLS, SUPPLY_PERIOD, DEFAULT_SUPPLY_VOLUME,
    get_all_group_names,
)


def test_get_satu_category_url_known():
    assert get_satu_category_url("Коммутаторы") == "https://satu.kz/Kommutatory"
    assert get_satu_category_url("Реле") == "https://satu.kz/Rele"
    assert get_satu_category_url("Блоки питания") == "https://satu.kz/Bloki-pitaniya"


def test_get_satu_category_url_fallback():
    assert get_satu_category_url("Несуществующая") == "https://satu.kz/Elektrooborudovanie"
    assert get_satu_category_url("Прочее") == "https://satu.kz/Elektrooborudovanie"


def test_all_groups_have_url():
    """Каждая группа из get_all_group_names() должна иметь URL."""
    for name in get_all_group_names():
        url = get_satu_category_url(name)
        assert url.startswith("https://satu.kz/"), f"Bad URL for {name!r}: {url}"


def test_get_supply_volume_cable():
    assert get_supply_volume("Кабель и провод") == 1000
    assert get_supply_volume("Кабельные каналы") == 500
    assert get_supply_volume("Лотки и аксессуары лотков") == 200


def test_get_supply_volume_default():
    assert get_supply_volume("Реле") == DEFAULT_SUPPLY_VOLUME
    assert get_supply_volume("Прочее") == DEFAULT_SUPPLY_VOLUME
    assert get_supply_volume("Неизвестная") == DEFAULT_SUPPLY_VOLUME


def test_supply_period():
    assert SUPPLY_PERIOD == "месяц"


if __name__ == "__main__":
    test_get_satu_category_url_known()
    test_get_satu_category_url_fallback()
    test_all_groups_have_url()
    test_get_supply_volume_cable()
    test_get_supply_volume_default()
    test_supply_period()
    print("Task 1: все тесты прошли.")
```

- [ ] **Step 3: Запустить тесты Task 1**

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
```

- [ ] **Step 4: Commit**

```bash
git add tenderbot/apisite/satu_categories.py tenderbot/apisite/test_satu_export.py
git commit -m "feat(satu): add SATU_CATEGORY_URLS, SUPPLY_VOLUMES and getters to satu_categories"
```

---

## Task 2: Добавить _build_description_from_attrs()

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py`
- Modify: `tenderbot/apisite/test_satu_export.py`

- [ ] **Step 1: Написать тест для _build_description_from_attrs()**

Добавить в конец `test_satu_export.py`:

```python
def test_build_description_from_attrs_with_attrs():
    from export_satu_excel import _build_description_from_attrs
    attrs = {"Номин. ток": "16 А", "Напряжение": "230 В", "Итого": "1500"}
    result = _build_description_from_attrs(
        name="Автоматический выключатель iC60N",
        model="A9F74116",
        brand="Schneider Electric",
        category="Автоматические выключатели",
        attrs=attrs,
    )
    assert "<h3>" in result
    assert "<table>" in result
    assert "<th>Производитель</th>" in result
    assert "Schneider Electric" in result
    assert "<th>Артикул</th>" in result
    assert "A9F74116" in result
    assert "Номин. ток" in result
    assert "16 А" in result
    # blacklist: Итого не должно попасть
    assert "Итого" not in result
    assert len(result) <= 12160


def test_build_description_from_attrs_no_brand():
    from export_satu_excel import _build_description_from_attrs
    result = _build_description_from_attrs(
        name="Реле",
        model="RXM2AB1P7",
        brand="",
        category="Реле",
        attrs={"Катушка": "230 В AC"},
    )
    assert "<th>Производитель</th>" not in result
    assert "RXM2AB1P7" in result


def test_build_description_from_attrs_empty_attrs():
    from export_satu_excel import _build_description_from_attrs
    result = _build_description_from_attrs(
        name="Товар",
        model="M123",
        brand="Brand",
        category="Прочее",
        attrs={},
    )
    # При пустых attrs возвращаем шаблон (не таблицу)
    assert len(result) > 0
```

- [ ] **Step 2: Запустить тесты — убедиться в FAIL**

```bash
cd tenderbot/apisite && python -m pytest test_satu_export.py::test_build_description_from_attrs_with_attrs -v 2>&1 | head -20
```

Ожидаемый вывод: `FAILED` или `ImportError` (функция ещё не существует).

- [ ] **Step 3: Реализовать _build_description_from_attrs() в export_satu_excel.py**

В `tenderbot/apisite/export_satu_excel.py`, после функции `_build_description_from_template` (строка ~677), добавить:

```python
def _build_description_from_attrs(
    name: str, model: str, brand: str, category: str, attrs: dict
) -> str:
    """Генерирует HTML-описание из словаря атрибутов товара.

    Используется когда нет description_html и description.txt,
    но есть атрибуты. Строит: заголовок + категорийный абзац + HTML-таблица.
    Атрибуты из _ATTRS_BLACKLIST исключаются.
    """
    if not attrs:
        return _build_description_from_template(name, model, brand, category)

    category_text = _CATEGORY_DESCRIPTIONS.get(category) or _CATEGORY_DESCRIPTIONS["Прочее"]

    rows = []
    if brand:
        rows.append(f"<tr><th>Производитель</th><td>{brand}</td></tr>")
    if model:
        rows.append(f"<tr><th>Артикул</th><td>{model}</td></tr>")
    for key, value in attrs.items():
        if key in _ATTRS_BLACKLIST:
            continue
        val_str = str(value).strip() if value else ""
        if not val_str:
            continue
        rows.append(f"<tr><th>{key}</th><td>{val_str}</td></tr>")

    if not rows:
        return _build_description_from_template(name, model, brand, category)

    table = "<table>" + "".join(rows) + "</table>"
    result = f"<h3>{name}</h3><p>{category_text}.</p>{table}"
    return result[:MAX_OPISANIE]
```

- [ ] **Step 4: Обновить _build_portal_by_model() — использовать новую функцию**

В `export_satu_excel.py` найти блок (строки ~421–430):

```python
        if desc_html:
            description = desc_html
        elif desc_plain:
            description = desc_plain
        else:
            attrs = data.get("attributes") or {}
            if attrs:
                rows = "".join(f"<li><b>{k}:</b> {v}</li>" for k, v in attrs.items())
                description = f"<h3>{name}</h3><ul>{rows}</ul>"
            else:
                # Шаблон вместо слабого фоллбэка
                category = classify_product(model, name)
                description = _build_description_from_template(name, model, brand, category)
```

Заменить на:

```python
        if desc_html:
            description = desc_html
        elif desc_plain:
            description = desc_plain
        else:
            attrs = data.get("attributes") or {}
            category = classify_product(model, name)
            description = _build_description_from_attrs(name, model, brand, category, attrs)
```

- [ ] **Step 5: Запустить тесты — убедиться в PASS**

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
```

(Тесты Task 2 тоже выполнятся — добавить их вызов в `if __name__ == "__main__":`)

Добавить в конец блока `if __name__ == "__main__":` в test_satu_export.py:

```python
    test_build_description_from_attrs_with_attrs()
    test_build_description_from_attrs_no_brand()
    test_build_description_from_attrs_empty_attrs()
    print("Task 2: все тесты прошли.")
```

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
Task 2: все тесты прошли.
```

- [ ] **Step 6: Commit**

```bash
git add tenderbot/apisite/export_satu_excel.py tenderbot/apisite/test_satu_export.py
git commit -m "feat(satu): add _build_description_from_attrs() — rich HTML table from attributes"
```

---

## Task 3: Расширить _build_search_queries() — добавить attrs

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py`
- Modify: `tenderbot/apisite/test_satu_export.py`

- [ ] **Step 1: Написать тест**

Добавить в конец `test_satu_export.py`:

```python
def test_build_search_queries_with_attrs():
    from export_satu_excel import _build_search_queries
    attrs = {"Номин. ток": "16 А", "Напряжение": "230 В", "Цвет": "красный"}
    result = _build_search_queries(
        name="Автоматический выключатель iC60N",
        brand="Schneider",
        category="Автоматические выключатели",
        attrs=attrs,
    )
    assert "16 А" in result or "16" in result
    assert len(result) <= 255


def test_build_search_queries_no_attrs():
    from export_satu_excel import _build_search_queries
    result = _build_search_queries(name="Реле", brand="ABB", category="Реле")
    assert len(result) <= 255
    assert len(result) > 0
```

- [ ] **Step 2: Запустить тест — убедиться в FAIL**

```bash
cd tenderbot/apisite && python -m pytest test_satu_export.py::test_build_search_queries_with_attrs -v 2>&1 | head -10
```

Ожидаемый вывод: `FAILED` (TypeError — attrs не принимается).

- [ ] **Step 3: Обновить _build_search_queries() в export_satu_excel.py**

Найти функцию (строка ~603):

```python
def _build_search_queries(name: str, brand: str = "", category: str = "", max_len: int = MAX_POISK_ZAPROS) -> str:
```

Заменить сигнатуру и добавить блок attrs:

```python
_KEY_ATTR_NAMES = ("Номин. ток", "Напряжение", "Мощность", "Ток", "Сечение", "Разрешение")


def _build_search_queries(
    name: str,
    brand: str = "",
    category: str = "",
    attrs: dict | None = None,
    max_len: int = MAX_POISK_ZAPROS,
) -> str:
    """Формирует поисковые запросы: слова из названия + бренд + категория + ключевые атрибуты."""
    if not name:
        return "товар"
    parts = []
    words = re.findall(r"[а-яёa-z0-9\-]+", name.lower(), re.I)
    words = [w[:50] for w in words if len(w) >= 2][:10]
    parts.extend(words)
    if brand and brand.lower() not in name.lower():
        parts.append(brand.lower())
    if category:
        parts.append(category.lower())
        parts.append(f"{category.lower()} купить")
        if brand:
            parts.append(f"{brand.lower()} {category.lower()}")
    if attrs:
        for key in _KEY_ATTR_NAMES:
            if key in attrs:
                val = str(attrs[key])[:50]
                if val and val not in parts:
                    parts.append(val)
    s = ", ".join(dict.fromkeys(parts))
    return s[:max_len] if s else "товар"
```

- [ ] **Step 4: Обновить вызов _build_search_queries() в build_full_excel()**

В `build_full_excel()` найти строку (~762):

```python
        search = _build_search_queries(name, brand, category)
```

Заменить на:

```python
        search = _build_search_queries(name, brand, category, attrs=attrs_raw)
```

- [ ] **Step 5: Запустить тесты**

Добавить в блок `if __name__ == "__main__":`:

```python
    test_build_search_queries_with_attrs()
    test_build_search_queries_no_attrs()
    print("Task 3: все тесты прошли.")
```

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
Task 2: все тесты прошли.
Task 3: все тесты прошли.
```

- [ ] **Step 6: Commit**

```bash
git add tenderbot/apisite/export_satu_excel.py tenderbot/apisite/test_satu_export.py
git commit -m "feat(satu): extend _build_search_queries() with key attribute values"
```

---

## Task 4: Расширить HEADERS_PRODUCTS и заполнить 6 новых колонок

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py`
- Modify: `tenderbot/apisite/test_satu_export.py`

- [ ] **Step 1: Написать тест на структуру заголовков**

Добавить в `test_satu_export.py`:

```python
def test_headers_products_count():
    from export_satu_excel import HEADERS_PRODUCTS
    assert len(HEADERS_PRODUCTS) == 28, f"Expected 28, got {len(HEADERS_PRODUCTS)}"


def test_headers_products_new_columns():
    from export_satu_excel import HEADERS_PRODUCTS
    headers = list(HEADERS_PRODUCTS)
    assert "Адрес_подраздела" in headers
    assert "Возможность_поставки" in headers
    assert "Срок_поставки" in headers
    assert "Способ_упаковки" in headers
    assert "Продукт_на_сайте" in headers
    assert "Номер_устройства_(MPN)" in headers
    # Порядок: новые колонки после Название_группы (index 21), до характеристик
    assert headers[22] == "Адрес_подраздела"
    assert headers[23] == "Возможность_поставки"
    assert headers[24] == "Срок_поставки"
    assert headers[25] == "Способ_упаковки"
    assert headers[26] == "Продукт_на_сайте"
    assert headers[27] == "Номер_устройства_(MPN)"
```

- [ ] **Step 2: Запустить тест — убедиться в FAIL**

```bash
cd tenderbot/apisite && python -m pytest test_satu_export.py::test_headers_products_count -v 2>&1 | head -10
```

Ожидаемый вывод: `FAILED` (AssertionError: Expected 28, got 22).

- [ ] **Step 3: Обновить HEADERS_PRODUCTS в export_satu_excel.py**

Найти константу `HEADERS_PRODUCTS` (строка ~298):

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
    "Адрес_подраздела",
    "Возможность_поставки",
    "Срок_поставки",
    "Способ_упаковки",
    "Продукт_на_сайте",
    "Номер_устройства_(MPN)",
)
```

- [ ] **Step 4: Добавить импорт get_satu_category_url и get_supply_volume**

В `export_satu_excel.py` найти строку:

```python
from satu_categories import classify_product, get_all_group_names, get_group_number
```

Заменить на:

```python
from satu_categories import (
    classify_product, get_all_group_names, get_group_number,
    get_satu_category_url, get_supply_volume, SUPPLY_PERIOD,
)
```

- [ ] **Step 5: Заполнить 6 новых колонок в build_full_excel()**

В `build_full_excel()` найти блок заполнения основных столбцов (строки ~800–822):

```python
        ws_products.cell(row=row_idx, column=21, value=get_group_number(category))
        ws_products.cell(row=row_idx, column=22, value=category)
```

После этих двух строк добавить:

```python
        # Новые колонки 23–28
        product_url = f"{api_base.rstrip('/')}/catalog/?model={quote(model)}" if api_base and model else ""
        ws_products.cell(row=row_idx, column=23, value=get_satu_category_url(category))
        ws_products.cell(row=row_idx, column=24, value=get_supply_volume(category))
        ws_products.cell(row=row_idx, column=25, value=SUPPLY_PERIOD)
        ws_products.cell(row=row_idx, column=26, value="в упаковке производителя")
        ws_products.cell(row=row_idx, column=27, value=product_url)
        ws_products.cell(row=row_idx, column=28, value=(p.get("model") or "")[:MAX_KOD_TOVARA])
```

- [ ] **Step 6: Обновить col_w (ширины колонок) в build_full_excel()**

Найти строку:

```python
    col_w = [14, 40, 18, 50, 12, 12, 8, 10, 8, 10, 14, 12, 8, 50, 10, 28, 28, 20, 40, 40, 12, 30]
```

Заменить на (добавить 6 значений):

```python
    col_w = [14, 40, 18, 50, 12, 12, 8, 10, 8, 10, 14, 12, 8, 50, 10, 28, 28, 20, 40, 40, 12, 30,
             45, 12, 10, 25, 50, 20]
```

- [ ] **Step 7: Запустить тесты**

Добавить в блок `if __name__ == "__main__":`:

```python
    test_headers_products_count()
    test_headers_products_new_columns()
    print("Task 4: все тесты прошли.")
```

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
Task 2: все тесты прошли.
Task 3: все тесты прошли.
Task 4: все тесты прошли.
```

- [ ] **Step 8: Commit**

```bash
git add tenderbot/apisite/export_satu_excel.py tenderbot/apisite/test_satu_export.py
git commit -m "feat(satu): expand HEADERS_PRODUCTS 22→28, fill Адрес_подраздела/Поставка/MPN/Продукт_на_сайте"
```

---

## Task 5: SEO для групп в Export Groups Sheet

**Files:**
- Modify: `tenderbot/apisite/export_satu_excel.py`
- Modify: `tenderbot/apisite/test_satu_export.py`

- [ ] **Step 1: Написать тест**

Добавить в `test_satu_export.py`:

```python
def test_groups_sheet_has_seo_columns():
    """Проверяет что build_full_excel создаёт 8 колонок в Groups Sheet."""
    import openpyxl
    from export_satu_excel import build_full_excel
    products = [{
        "name": "Тест",
        "model": "TST-001",
        "brand": "TestBrand",
        "quantity": 5,
        "price_rrc": 1000.0,
        "final_price": 1000.0,
        "description": "Описание",
        "image_paths": [],
        "folder": "",
        "attributes": {},
    }]
    wb, _ = build_full_excel(products, image_via_api=False)
    ws = wb["Export Groups Sheet"]
    headers = [ws.cell(row=1, column=c).value for c in range(1, 9)]
    assert "HTML_заголовок_группы" in headers, f"headers={headers}"
    assert "Описание_группы_до_списка_товарных_позиций" in headers
    assert "Описание_группы_после_списка_товарных_позиций" in headers
    # Проверим что CTA заполнен для первой группы
    cta = ws.cell(row=2, column=8).value
    assert cta and "G&R Group" in cta
```

- [ ] **Step 2: Запустить тест — убедиться в FAIL**

```bash
cd tenderbot/apisite && python -m pytest test_satu_export.py::test_groups_sheet_has_seo_columns -v 2>&1 | head -15
```

Ожидаемый вывод: `FAILED` (AssertionError — HTML_заголовок_группы не в headers).

- [ ] **Step 3: Обновить блок Export Groups Sheet в build_full_excel()**

В `export_satu_excel.py` найти блок (строки ~842–854):

```python
    # --- Вкладка «Export Groups Sheet» ---
    ws_groups = wb.create_sheet("Export Groups Sheet", 1)
    headers_groups = ["Номер_группы", "Название_группы", "Идентификатор_группы", "Номер_родителя", "Идентификатор_родителя"]
    for col, h in enumerate(headers_groups, 1):
        c = ws_groups.cell(row=1, column=col, value=h)
        c.font = openpyxl.styles.Font(bold=True)
    for grp_idx, grp_name in enumerate(get_all_group_names(), 1):
        ws_groups.cell(row=grp_idx + 1, column=1, value=grp_idx)
        ws_groups.cell(row=grp_idx + 1, column=2, value=grp_name)
        for col in range(3, 6):
            ws_groups.cell(row=grp_idx + 1, column=col, value="")
    for col in range(1, 6):
        ws_groups.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 25
```

Заменить полностью на:

```python
    # --- Вкладка «Export Groups Sheet» ---
    _GROUPS_CTA = (
        "G&R Group — официальный поставщик электротехнического и слаботочного "
        "оборудования в Казахстане. Работаем с юридическими и физическими лицами. "
        "Оптовые и розничные цены. Доставка по Алматы, Астане и всем регионам РК. "
        "Подберём аналог, выставим счёт, оформим документы. "
        "Звоните или пишите на сайте grgroup.kz."
    )
    ws_groups = wb.create_sheet("Export Groups Sheet", 1)
    headers_groups = [
        "Номер_группы",
        "Название_группы",
        "Идентификатор_группы",
        "Номер_родителя",
        "Идентификатор_родителя",
        "HTML_заголовок_группы",
        "Описание_группы_до_списка_товарных_позиций",
        "Описание_группы_после_списка_товарных_позиций",
    ]
    for col, h in enumerate(headers_groups, 1):
        c = ws_groups.cell(row=1, column=col, value=h)
        c.font = openpyxl.styles.Font(bold=True)
    for grp_idx, grp_name in enumerate(get_all_group_names(), 1):
        seo_title = f"{grp_name} — купить в Астане | G&R Group"[:250]
        grp_desc = (_CATEGORY_DESCRIPTIONS.get(grp_name) or _CATEGORY_DESCRIPTIONS["Прочее"])[:500]
        ws_groups.cell(row=grp_idx + 1, column=1, value=grp_idx)
        ws_groups.cell(row=grp_idx + 1, column=2, value=grp_name)
        ws_groups.cell(row=grp_idx + 1, column=3, value="")
        ws_groups.cell(row=grp_idx + 1, column=4, value="")
        ws_groups.cell(row=grp_idx + 1, column=5, value="")
        ws_groups.cell(row=grp_idx + 1, column=6, value=seo_title)
        ws_groups.cell(row=grp_idx + 1, column=7, value=grp_desc)
        ws_groups.cell(row=grp_idx + 1, column=8, value=_GROUPS_CTA)
    col_widths_groups = [12, 35, 12, 12, 12, 50, 60, 80]
    for col, w in enumerate(col_widths_groups, 1):
        ws_groups.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w
```

- [ ] **Step 4: Запустить тесты**

Добавить в блок `if __name__ == "__main__":`:

```python
    test_groups_sheet_has_seo_columns()
    print("Task 5: все тесты прошли.")
```

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
Task 2: все тесты прошли.
Task 3: все тесты прошли.
Task 4: все тесты прошли.
Task 5: все тесты прошли.
```

- [ ] **Step 5: Commit**

```bash
git add tenderbot/apisite/export_satu_excel.py tenderbot/apisite/test_satu_export.py
git commit -m "feat(satu): add Groups SEO — HTML_заголовок_группы + описания до/после списка"
```

---

## Task 6: Итоговая проверка — smoke test генерации файла

**Files:**
- Modify: `tenderbot/apisite/test_satu_export.py`

- [ ] **Step 1: Написать smoke test полного файла**

Добавить в `test_satu_export.py`:

```python
def test_build_full_excel_smoke():
    """Smoke test: build_full_excel не падает и создаёт корректный файл."""
    import openpyxl
    from export_satu_excel import build_full_excel, HEADERS_PRODUCTS
    products = [
        {
            "name": "Автоматический выключатель iC60N 16A",
            "model": "A9F74116",
            "brand": "Schneider Electric",
            "quantity": 10,
            "price_rrc": 5000.0,
            "final_price": 4500.0,
            "description": "<p>Описание товара</p>",
            "image_paths": [],
            "folder": "",
            "attributes": {"Номин. ток": "16 А", "Напряжение": "230 В"},
        },
        {
            "name": "Реле промежуточное",
            "model": "RXM2AB1P7",
            "brand": "",
            "quantity": 0,
            "price_rrc": 0.0,
            "final_price": 0.0,
            "description": "",
            "image_paths": [],
            "folder": "",
            "attributes": {},
        },
    ]
    wb, count = build_full_excel(products, image_via_api=False)
    assert count == 2

    ws_p = wb["Export Products Sheet"]
    # Заголовки: 28 основных + характеристики
    header_row = [ws_p.cell(row=1, column=c).value for c in range(1, 29)]
    assert list(header_row) == list(HEADERS_PRODUCTS)

    # Продукт 1: проверяем новые колонки (23–28)
    assert ws_p.cell(row=2, column=23).value.startswith("https://satu.kz/")
    assert isinstance(ws_p.cell(row=2, column=24).value, int)
    assert ws_p.cell(row=2, column=25).value == "месяц"
    assert ws_p.cell(row=2, column=26).value == "в упаковке производителя"
    # col 27 (Продукт_на_сайте) пусто если нет api_base_url
    assert ws_p.cell(row=2, column=28).value == "A9F74116"

    ws_g = wb["Export Groups Sheet"]
    # Проверяем Groups SEO
    g_headers = [ws_g.cell(row=1, column=c).value for c in range(1, 9)]
    assert "HTML_заголовок_группы" in g_headers
    assert "Описание_группы_до_списка_товарных_позиций" in g_headers

    print("Smoke test прошёл.")
```

- [ ] **Step 2: Запустить финальный тест**

Добавить в блок `if __name__ == "__main__":`:

```python
    test_build_full_excel_smoke()
    print("Task 6: smoke test прошёл. Все задачи выполнены.")
```

```bash
cd tenderbot/apisite && python test_satu_export.py
```

Ожидаемый вывод:
```
Task 1: все тесты прошли.
Task 2: все тесты прошли.
Task 3: все тесты прошли.
Task 4: все тесты прошли.
Task 5: все тесты прошли.
Smoke test прошёл.
Task 6: smoke test прошёл. Все задачи выполнены.
```

- [ ] **Step 3: Итоговый commit**

```bash
git add tenderbot/apisite/test_satu_export.py
git commit -m "test(satu): add smoke test for full Excel generation with 28 columns + Groups SEO"
```

---

## Self-Review

**Spec coverage:**
- [x] 6 новых колонок (col 23–28) — Task 4 + Task 5
- [x] SATU_CATEGORY_URLS + SUPPLY_VOLUMES — Task 1
- [x] `_build_description_from_attrs()` — Task 2
- [x] Приоритеты описания (html → txt → attrs → template) — Task 2 Step 4
- [x] `_build_search_queries()` + attrs — Task 3
- [x] Groups SEO (8 колонок) — Task 5
- [x] CTA текст — Task 5

**Placeholder scan:** Все шаги содержат конкретный код. Нет TBD.

**Type consistency:**
- `_build_description_from_attrs(name, model, brand, category, attrs)` — вызывается в Task 2 Step 4 с теми же аргументами
- `_build_search_queries(..., attrs=attrs_raw)` — вызывается в Task 3 Step 4, `attrs_raw` уже определён в `build_full_excel()`
- `get_satu_category_url(category)` / `get_supply_volume(category)` — импортируются в Task 4 Step 4, используются в Task 4 Step 5
- `SUPPLY_PERIOD` — импортирован в Task 4 Step 4, использован в Task 4 Step 5
