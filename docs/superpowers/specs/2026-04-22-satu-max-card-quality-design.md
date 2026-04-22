# Satu: максимальное заполнение карточек товаров

**Дата:** 2026-04-22
**Статус:** Утверждён

## Цель

Довести XLSX-экспорт для Satu.kz до максимальной полноты: заполнить все возможные колонки формата импорта, улучшить описания товаров, добавить SEO для групп.

## 1. Новые колонки в «Export Products Sheet»

### 1.1 Расширение HEADERS_PRODUCTS (с 22 до 28)

Добавляем 6 столбцов между `Название_группы` (col 22) и блоками характеристик:

| # | Столбец | Значение |
|---|---------|----------|
| 23 | `Адрес_подраздела` | URL категории на satu.kz из словаря `SATU_CATEGORY_URLS` |
| 24 | `Возможность_поставки` | Число из словаря `SUPPLY_VOLUMES` (напр. 1000 для кабеля, 100 для остальных) |
| 25 | `Срок_поставки` | `"месяц"` для всех категорий |
| 26 | `Способ_упаковки` | `"в упаковке производителя"` для всех |
| 27 | `Продукт_на_сайте` | `{SITEMAP_BASE_URL}/catalog/?model={url_encoded_model}` |
| 28 | `Номер_устройства_(MPN)` | `model` (артикул — у нас всегда есть) |

Блоки характеристик начинаются с col 29.

### 1.2 Словарь `SATU_CATEGORY_URLS` (в `satu_categories.py`)

Полный маппинг всех 36 категорий → URL страницы на satu.kz:

```python
SATU_CATEGORY_URLS: dict[str, str] = {
    "Видеокамеры":                     "https://satu.kz/Videonablyudenie/videokamery",
    "Видеорегистраторы":               "https://satu.kz/Videonablyudenie/videoregistratory",
    "Коммутаторы":                     "https://satu.kz/Setevoe-oborudovanie/kommutatory",
    "Точки доступа и маршрутизаторы":  "https://satu.kz/Setevoe-oborudovanie/tochki-dostupa",
    "Мониторы и дисплеи":              "https://satu.kz/Kompyutery-i-periferiya/monitory",
    "Жёсткие диски":                   "https://satu.kz/Kompyutery-i-periferiya/zhestkie-diski",
    "Кронштейны и крепёж":             "https://satu.kz/Stroitelstvo-i-remont/krepezh",
    "Контроль доступа (СКУД)":         "https://satu.kz/Bezopasnost/kontrol-dostupa",
    "Аудио и видеотехника":            "https://satu.kz/Bytovaya-tehnika/audiotehnika",
    "Кабель и провод":                 "https://satu.kz/Elektrika/kabel-i-provod",
    "Кабельные каналы":                "https://satu.kz/Elektrika/kabelnie-kanaly",
    "Лотки и аксессуары лотков":       "https://satu.kz/Elektrika/kabelnie-lotki",
    "Автоматические выключатели":      "https://satu.kz/Elektrika/avtomaticheskie-vyklyuchateli",
    "Дифференциальная защита":         "https://satu.kz/Elektrika/differencialnye-vyklyuchateli",
    "Контакторы и пускатели":          "https://satu.kz/Elektrika/kontaktory",
    "Светодиодные лампы":              "https://satu.kz/Osveschenie/svetodiodnye-lampy",
    "Светильники и прожекторы":        "https://satu.kz/Osveschenie/svetilniki",
    "Светодиодные ленты":              "https://satu.kz/Osveschenie/svetodiodnye-lenty",
    "Наконечники и гильзы":            "https://satu.kz/Elektrika/nakonechniki-i-gilzy",
    "Розетки и выключатели":           "https://satu.kz/Elektrika/rozetki-i-vyklyuchateli",
    "Датчики":                         "https://satu.kz/Elektrika/datchiki",
    "Реле":                            "https://satu.kz/Elektrika/rele",
    "Электродвигатели":                "https://satu.kz/Elektrika/elektrodvigateli",
    "Шкафы и щиты":                    "https://satu.kz/Elektrika/elektricheskie-schity",
    "Трансформаторы":                  "https://satu.kz/Elektrika/transformatory",
    "Разъемы и коннекторы":            "https://satu.kz/Elektrika/razemy-i-konnektory",
    "Блоки питания":                   "https://satu.kz/Elektrika/bloki-pitaniya",
    "Зажимы и клеммы":                 "https://satu.kz/Elektrika/klemmy",
    "Монтажные коробки":               "https://satu.kz/Elektrika/montazhnye-korobki",
    "Частотные преобразователи":       "https://satu.kz/Elektrika/chastotnye-preobrazovateli",
    "Муфты и трубы":                   "https://satu.kz/Elektrika/elektricheskie-truby",
    "Устройства плавного пуска":       "https://satu.kz/Elektrika/ustroystva-plavnogo-puska",
    "Кнопки управления":               "https://satu.kz/Elektrika/knopki-upravleniya",
    "Патроны и стартёры":              "https://satu.kz/Osveschenie/patrony",
    "Счётчики электроэнергии":         "https://satu.kz/Elektrika/schetchiki-elektroenergii",
    "Прочее":                          "https://satu.kz/Elektrika",
}
```

### 1.3 Словарь `SUPPLY_VOLUMES` (в `satu_categories.py`)

```python
SUPPLY_VOLUMES: dict[str, int] = {
    "Кабель и провод":   1000,  # метры
    "Кабельные каналы":  500,
    "Лотки и аксессуары лотков": 200,
    # всё остальное — 100 шт
}
SUPPLY_PERIOD = "месяц"  # для всех категорий
DEFAULT_SUPPLY_VOLUME = 100
```

Функции-геттеры:
```python
def get_satu_category_url(category: str) -> str:
    return SATU_CATEGORY_URLS.get(category, SATU_CATEGORY_URLS["Прочее"])

def get_supply_volume(category: str) -> int:
    return SUPPLY_VOLUMES.get(category, DEFAULT_SUPPLY_VOLUME)
```

## 2. Улучшение «Описание»

### 2.1 Приоритеты (не меняются)

1. `description_html` из `product.json` → используем как есть
2. `description.txt` из папки → используем как есть
3. `attributes` непустые → **новая функция** `_build_description_from_attrs()`
4. Шаблон категории → `_build_description_from_template()` (без изменений)

### 2.2 Новая функция `_build_description_from_attrs()`

Генерирует HTML-описание когда есть attributes но нет текстового описания:

```html
<h3>{name}</h3>
<p>{категорийный текст из _CATEGORY_DESCRIPTIONS}.</p>
<table>
  <tr><th>Производитель</th><td>{brand}</td></tr>   <!-- если brand не пустой -->
  <tr><th>Артикул</th><td>{model}</td></tr>          <!-- если model не пустой -->
  <tr><th>Attr1</th><td>Val1</td></tr>
  <tr><th>Attr2</th><td>Val2</td></tr>
  ...
</table>
```

- Все атрибуты из `attrs` (кроме blacklist) попадают в таблицу
- Производитель и артикул — первые строки таблицы (если есть)
- Атрибуты из blacklist (`Итого`, `Код Elevel`) — не попадают
- Результат обрезается до `MAX_OPISANIE` (12 160 символов)

### 2.3 Усиление `_build_search_queries()`

Сигнатура расширяется: добавляем `attrs: dict | None = None`.

Добавляем ключевые значения из attributes для поиска по техническим параметрам:

```python
KEY_ATTR_NAMES = ("Номин. ток", "Напряжение", "Мощность", "Ток", "Сечение", "Разрешение")
if attrs:
    for key in KEY_ATTR_NAMES:
        if key in attrs:
            val = str(attrs[key])[:50]
            if val and val not in parts:
                parts.append(val)
```

Итоговая строка по-прежнему обрезается до 255 символов.

Все места вызова `_build_search_queries()` обновляются — передаём `attrs=attrs_raw`.

## 3. SEO групп в «Export Groups Sheet»

### 3.1 Новые колонки (8 вместо 5)

| # | Колонка | Значение |
|---|---------|----------|
| 1 | `Номер_группы` | порядковый номер (как сейчас) |
| 2 | `Название_группы` | название категории (как сейчас) |
| 3 | `Идентификатор_группы` | пусто (как сейчас) |
| 4 | `Номер_родителя` | пусто (как сейчас) |
| 5 | `Идентификатор_родителя` | пусто (как сейчас) |
| 6 | `HTML_заголовок_группы` | `"{Название_группы} — купить в Астане \| G&R Group"` |
| 7 | `Описание_группы_до_списка_товарных_позиций` | текст из `_CATEGORY_DESCRIPTIONS` (до 500 символов) |
| 8 | `Описание_группы_после_списка_товарных_позиций` | фиксированный CTA (см. ниже) |

### 3.2 CTA-текст для col 8 (единый для всех групп)

```
G&R Group — официальный поставщик электротехнического и слаботочного оборудования в Казахстане.
Работаем с юридическими и физическими лицами. Оптовые и розничные цены. Доставка по Алматы, Астане и всем регионам РК.
Подберём аналог, выставим счёт, оформим документы. Звоните или пишите на сайте grgroup.kz.
```

## 4. Изменяемые файлы

| Файл | Что меняем |
|------|-----------|
| `satu_categories.py` | `SATU_CATEGORY_URLS`, `SUPPLY_VOLUMES`, `SUPPLY_PERIOD`, `DEFAULT_SUPPLY_VOLUME`, `get_satu_category_url()`, `get_supply_volume()` |
| `export_satu_excel.py` | `HEADERS_PRODUCTS` (22→28), `_build_description_from_attrs()` (новая), `_build_search_queries()` (ключевые атрибуты), `_build_portal_by_model()` (вызов новой функции), `build_full_excel()` (новые столбцы + Groups SEO) |

## 5. Не делаем (осознанно)

- `Скидка`, `Срок действия скидки` — управляется через кабинет Satu
- `GTIN`, `NTIN` — нет данных в нашей базе
- `Подарки`, `Сопутствующие` — нет данных
- `Ярлык` — управляется через кабинет Satu
- `ID_группы_разновидностей` — нет вариантов товаров в текущей модели данных
- `Уникальный_идентификатор`, `Идентификатор_подраздела` — заполняются Satu автоматически при экспорте, при импорте не нужны
