# Обогащение товаров из complex.com.kz — Спецификация

## Проблема

85.8% товаров (5 326 из 6 205) в `portal_export/` не имеют ни описания, ни атрибутов. При экспорте в Satu эти карточки получают только шаблонное описание из `_build_description_from_template()`, что снижает качество каталога на портале.

При этом каждый товар имеет `product_url` на complex.com.kz, где доступны полное описание и таблица характеристик.

## Решение

Скрипт `enrich_products.py`, который:
1. Находит товары без описания/атрибутов в `portal_export/`
2. Парсит страницу товара на complex.com.kz
3. Извлекает описание, характеристики и бренд
4. Сохраняет в `product.json` с флагом `"enriched": true`

## Архитектура

### Файл: `tenderbot/apisite/enrich_products.py`

Один скрипт, три этапа:

```
Сбор целей → Парсинг complex.com.kz (async) → Сохранение в product.json
```

### Этап 1: Сбор целей

Итерация `portal_export/*/product.json`. Товар является целью если:
- `attributes` пустой или содержит только blacklisted ключи ("Итого", "Код Elevel")
- `description_html` пустой/отсутствует
- Нет флага `"enriched"` (или `--force`)
- `product_url` содержит `complex.com.kz`

### Этап 2: Парсинг complex.com.kz

**Транспорт:** `aiohttp` — 10 параллельных воркеров, задержка 0.5 сек между запросами одного воркера.

**Парсер `_parse_product_page(html) -> dict | None`:**

Извлекает из HTML (BeautifulSoup):

| Поле | Источник | Куда в product.json |
|------|----------|---------------------|
| Описание | Текстовый блок описания товара | `description_html` |
| Характеристики | Таблица параметр→значение | `attributes` (dict) |
| Бренд | Поле производителя | `brand` (только если пустой) |

**Обработка ошибок:**
- Таймаут: 15 сек на запрос
- Retry: 2 попытки с экспоненциальным backoff (2 сек, 4 сек)
- HTTP 429: пауза 10 сек, повтор
- HTTP 404 / пустая страница: `"enriched": "failed"`, пропуск

### Этап 3: Сохранение

Перезапись `product.json`:
- Добавляет `description_html` если поле пустое
- Добавляет `attributes` если dict пустой или только blacklisted
- Обновляет `brand` если поле пустое
- Ставит `"enriched": true` (успех) или `"enriched": "failed"` (ошибка)
- Существующие непустые поля НЕ перезаписываются

### CLI

```bash
cd tenderbot/apisite && python enrich_products.py
```

Опции:
- `--dry-run` — только считает товары-цели, без HTTP-запросов
- `--limit N` — обработать первые N товаров
- `--force` — игнорировать флаг `"enriched"`, перепарсить всё

### Вывод прогресса

```
[42/5326] enriched 13976 — 22 attrs, description 350 chars
[43/5326] failed   13977 — 404 Not Found
...
Done: enriched 4200, failed 126, skipped 1000
```

## Интеграция

- **Пайплайн:** запускается после парсинга каталога complex.com.kz
- **Экспорт Satu:** никаких изменений — `export_satu_excel.py` уже читает `attributes` и `description_html` из `product.json`
- **Повторный запуск:** безопасен благодаря флагу `"enriched"`

## Зависимости

- `aiohttp` — async HTTP клиент (добавить в requirements.txt)
- `beautifulsoup4` — HTML парсер (уже есть)
- `lxml` — быстрый парсер для BS4 (добавить в requirements.txt)

## Тестирование

- Юнит-тест `_parse_product_page()` с сохранённым HTML-сэмплом
- Интеграционный тест: `--limit 3` на реальных URL
- `--dry-run` для проверки количества целей перед полным запуском

## Файлы

| Действие | Файл |
|----------|------|
| Создать | `tenderbot/apisite/enrich_products.py` |
| Модифицировать | `tenderbot/requirements.txt` (добавить aiohttp, lxml) |
| Создать | `tenderbot/apisite/test_enrich_products.py` |
