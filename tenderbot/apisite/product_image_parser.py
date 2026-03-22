"""
Парсер изображений товаров для сайта complex.com.kz/portal

Логика работы:
1. Парсит страницы каталога и карточек товаров
2. Находит все img[src] содержащие /image/cache/
3. Преобразует URL к оригиналу:
   - /image/cache/ → /image/catalog/
   - Удаляет суффиксы размеров (-360x360, -228x228 и т.п.)
4. Скачивает оригинальные изображения в структуру images/{model}/
"""
import requests
import logging
import time
import re
import json
from typing import Dict, List, Set, Optional
from urllib.parse import urljoin, urlparse
from pathlib import Path
from bs4 import BeautifulSoup

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Базовые настройки
BASE_URL = "https://complex.com.kz"
PORTAL_URL = f"{BASE_URL}/portal"
IMAGES_DIR = Path(__file__).parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)

# Файл для хранения кэша обработанных товаров и изображений
PARSER_CACHE_FILE = Path(__file__).parent / "data" / "parser_cache.json"
PARSER_CACHE_FILE.parent.mkdir(exist_ok=True)

# Глобальный кэш обработанных данных
_parser_cache = {
    "processed_models": set(),  # Модели товаров, для которых уже скачаны изображения
    "processed_images": set(),   # URL изображений, которые уже скачаны
    "processed_pages": set()     # Номера страниц, которые уже обработаны
}

# User-Agent для запросов
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Задержка между запросами (секунды)
REQUEST_DELAY = 1.0

# Создаем сессию для сохранения cookies
session = requests.Session()
session.headers.update({
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
})

# Данные для авторизации (можно вынести в config или переменные окружения)
LOGIN_URL = f"{BASE_URL}/login"
LOGIN_USERNAME = "7714215593"
LOGIN_PASSWORD = "Stepanyan1961"


def load_parser_cache():
    """Загружает кэш обработанных товаров и изображений из файла"""
    global _parser_cache
    try:
        if PARSER_CACHE_FILE.exists():
            with open(PARSER_CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                _parser_cache["processed_models"] = set(data.get("processed_models", []))
                _parser_cache["processed_images"] = set(data.get("processed_images", []))
                _parser_cache["processed_pages"] = set(data.get("processed_pages", []))
                logger.info(f"Загружен кэш парсера: {len(_parser_cache['processed_models'])} моделей, "
                          f"{len(_parser_cache['processed_images'])} изображений, "
                          f"{len(_parser_cache['processed_pages'])} страниц")
    except Exception as e:
        logger.warning(f"Не удалось загрузить кэш парсера: {e}")
        _parser_cache = {
            "processed_models": set(),
            "processed_images": set(),
            "processed_pages": set()
        }


def save_parser_cache():
    """Сохраняет кэш обработанных товаров и изображений в файл"""
    try:
        data = {
            "processed_models": list(_parser_cache["processed_models"]),
            "processed_images": list(_parser_cache["processed_images"]),
            "processed_pages": list(_parser_cache["processed_pages"])
        }
        with open(PARSER_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.debug(f"Кэш парсера сохранен: {len(_parser_cache['processed_models'])} моделей, "
                    f"{len(_parser_cache['processed_images'])} изображений")
    except Exception as e:
        logger.warning(f"Не удалось сохранить кэш парсера: {e}")


def is_model_processed(model: str) -> bool:
    """Проверяет, обработан ли уже товар с этой моделью"""
    normalized = normalize_model_name(model)
    return normalized in _parser_cache["processed_models"] or model in _parser_cache["processed_models"]


def is_image_processed(image_url: str) -> bool:
    """Проверяет, скачано ли уже это изображение"""
    return image_url in _parser_cache["processed_images"]


def mark_model_processed(model: str):
    """Помечает модель как обработанную"""
    normalized = normalize_model_name(model)
    _parser_cache["processed_models"].add(model)
    _parser_cache["processed_models"].add(normalized)


def mark_image_processed(image_url: str):
    """Помечает изображение как обработанное"""
    _parser_cache["processed_images"].add(image_url)


def is_page_processed(page: int) -> bool:
    """Проверяет, обработана ли уже эта страница"""
    return page in _parser_cache["processed_pages"]


def mark_page_processed(page: int):
    """Помечает страницу как обработанную"""
    _parser_cache["processed_pages"].add(page)


def normalize_image_url(url: str) -> Optional[str]:
    """
    Преобразует URL изображения из кэша к оригиналу
    
    Примеры:
    - /image/cache/catalog/32244_1-360x360-360x360.jpg → /image/catalog/32244_1.jpg
    - /image/cache/catalog/32244_1-360x360-228x228.jpg → /image/catalog/32244_1.jpg
    
    Args:
        url: URL изображения из кэша
        
    Returns:
        URL оригинального изображения или None если URL невалидный
    """
    if not url or '/image/cache/' not in url:
        return None
    
    try:
        # Если URL относительный, делаем его абсолютным
        if url.startswith('/'):
            url = f"{BASE_URL}{url}"
        elif not url.startswith('http'):
            url = urljoin(BASE_URL, url)
        
        # Заменяем /image/cache/ на /image/catalog/
        normalized = url.replace('/image/cache/', '/image/catalog/')
        
        # Удаляем суффиксы размеров вида -360x360, -228x228 и т.п.
        # Паттерн: -числоxчисло (может повторяться несколько раз)
        pattern = r'-\d+x\d+'
        normalized = re.sub(pattern, '', normalized)
        
        # Убираем дублирующиеся расширения (если остались)
        # Например: 32244_1.jpg.jpg → 32244_1.jpg
        normalized = re.sub(r'\.(jpg|jpeg|png|webp)\.(jpg|jpeg|png|webp)$', r'.\1', normalized)
        
        logger.debug(f"Нормализован URL: {url} → {normalized}")
        return normalized
        
    except Exception as e:
        logger.error(f"Ошибка нормализации URL {url}: {e}")
        return None


def download_image(url: str, save_path: Path, check_cache: bool = True) -> bool:
    """
    Скачивает изображение по URL и сохраняет в указанный путь
    
    Args:
        url: URL изображения
        save_path: Путь для сохранения
        check_cache: Проверять ли кэш обработанных изображений
        
    Returns:
        True если успешно, False в противном случае
    """
    try:
        # Проверяем кэш обработанных изображений
        if check_cache and is_image_processed(url):
            logger.debug(f"Изображение уже обработано (из кэша): {url}")
            return True
        
        # Проверяем, не существует ли уже файл
        if save_path.exists():
            logger.debug(f"Изображение уже существует: {save_path}")
            # Помечаем как обработанное в кэше
            if check_cache:
                mark_image_processed(url)
            return True
        
        # Создаем директорию если нужно
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Загружаем изображение через сессию
        response = session.get(url, timeout=15, stream=True)
        
        if response.status_code != 200:
            logger.warning(f"Не удалось загрузить изображение {url}, статус: {response.status_code}")
            return False
        
        # Проверяем Content-Type
        content_type = response.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            logger.warning(f"URL {url} не является изображением, Content-Type: {content_type}")
            return False
        
        # Сохраняем файл
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Помечаем как обработанное в кэше
        if check_cache:
            mark_image_processed(url)
        
        logger.info(f"✓ Скачано: {save_path.name} ({save_path.stat().st_size} bytes)")
        return True
        
    except Exception as e:
        logger.error(f"Ошибка при скачивании {url}: {e}")
        return False


def extract_model_from_url(url: str) -> Optional[str]:
    """
    Извлекает модель товара из URL карточки товара
    
    Args:
        url: URL карточки товара
        
    Returns:
        Модель товара или None
    """
    try:
        # Пытаемся найти модель в URL (например, /product/ipc-2122-apf28)
        match = re.search(r'/product/([^/?]+)', url)
        if match:
            return match.group(1)
        
        # Или из query параметров (product_id - это не модель, но можем использовать как fallback)
        # Но лучше вернуть None, так как product_id - это не модель товара
        # match = re.search(r'product_id=(\d+)', url)
        # if match:
        #     return match.group(1)
            
        return None
    except Exception as e:
        logger.debug(f"Не удалось извлечь модель из URL {url}: {e}")
        return None


def parse_product_page(url: str, model: Optional[str] = None) -> Set[str]:
    """
    Парсит страницу карточки товара и извлекает URL оригинальных изображений
    
    Args:
        url: URL страницы товара
        model: Модель товара (если известна)
        
    Returns:
        Множество URL оригинальных изображений
    """
    image_urls = set()
    
    try:
        # Используем сессию для сохранения cookies
        response = session.get(url, timeout=20)
        
        if response.status_code != 200:
            logger.warning(f"Не удалось загрузить страницу товара {url}, статус: {response.status_code}")
            return image_urls
        
        soup = BeautifulSoup(response.content, 'lxml')
        
        # Находим все изображения с /image/cache/
        images = soup.find_all('img', src=re.compile(r'/image/cache/'))
        
        logger.info(f"Найдено {len(images)} изображений на странице {url}")
        
        for img in images:
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if not src:
                continue
            
            # Нормализуем URL к оригиналу
            original_url = normalize_image_url(src)
            if original_url:
                image_urls.add(original_url)
                logger.debug(f"Найдено оригинальное изображение: {original_url}")
        
        # Если модель не была передана, пытаемся извлечь из URL
        if not model:
            model = extract_model_from_url(url)
        
        return image_urls
        
    except Exception as e:
        logger.error(f"Ошибка при парсинге страницы товара {url}: {e}")
        return image_urls


def extract_model_from_text(text: str) -> Optional[str]:
    """
    Извлекает модель товара из текста (название товара обычно содержит модель)
    
    Args:
        text: Текст для анализа
        
    Returns:
        Модель товара или None
    """
    if not text:
        return None
    
    # Паттерны для поиска моделей (например: NVR501-16B, DHI-NVR1104HS-P-S3/H, IPC264SA-DZK)
    patterns = [
        # Паттерн для моделей типа NVR501-16B, DHI-NVR1104HS-P-S3/H
        r'\b([A-Z]{2,}\d+[A-Z0-9\-/]+[A-Z0-9])\b',  # NVR501-16B, DHI-NVR1104HS-P-S3/H
        # Паттерн для моделей типа IPC264SA-DZK, IPC2A24SE-ADZK-10
        r'\b([A-Z]{2,}\d+[A-Z0-9\-]+)\b',  # IPC264SA-DZK, IPC2A24SE-ADZK-10
        # Паттерн для моделей без дефисов
        r'\b([A-Z]{3,}\d+[A-Z0-9]+)\b',   # IPC264SA, IPC3238SB
        # Общий паттерн
        r'\b([A-Z]+\d+[A-Z0-9\-/]+)\b',      # Общий паттерн
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        if matches:
            # Берем первую найденную модель
            model = matches[0]
            # Фильтруем слишком короткие или слишком длинные результаты
            # Также фильтруем результаты, которые выглядят как даты или другие числа
            if 5 <= len(model) <= 50 and not re.match(r'^\d+$', model):
                return model
    
    return None


def parse_catalog_page_ajax(page: int = 1, skip_processed: bool = True) -> Dict[str, List[str]]:
    """
    Парсит страницу каталога через AJAX-эндпоинт (более надежный способ)
    
    Args:
        page: Номер страницы каталога
        skip_processed: Пропускать ли уже обработанные товары
        
    Returns:
        Словарь {model: [image_urls]}
    """
    products_images = {}
    
    # Проверяем, не обработана ли уже эта страница
    if skip_processed and is_page_processed(page):
        logger.info(f"⏭️  Страница {page} уже обработана (AJAX), пропускаем")
        return products_images
    
    try:
        # AJAX-эндпоинт для получения товаров
        ajax_url = f"{BASE_URL}/index.php?route=product/allproduct/ajax"
        params = {
            'page': page,
            'sort': 'p.sort_order',
            'order': 'ASC',
            'v_ajax': '1'
        }
        
        logger.info(f"📡 AJAX запрос страницы {page}: {ajax_url}")
        
        response = session.get(ajax_url, params=params, timeout=20)
        
        if response.status_code != 200:
            logger.warning(f"Не удалось загрузить AJAX страницу {page}, статус: {response.status_code}")
            return products_images
        
        # AJAX возвращает JSON с HTML в поле 'products'
        try:
            data = response.json()
            products_html = data.get('products', '')
            
            if not products_html:
                logger.warning(f"AJAX ответ не содержит products для страницы {page}")
                return products_images
            
            soup = BeautifulSoup(products_html, 'lxml')
            
            # Ищем строки таблицы с товарами
            product_rows = soup.find_all('tr', class_=lambda x: x and ('product-layout' in x or 'product-grid' in x))
            
            if not product_rows:
                # Ищем tbody#prods2
                tbody = soup.find('tbody', id='prods2')
                if tbody:
                    product_rows = tbody.find_all('tr')
                    product_rows = [row for row in product_rows if row.find('img', src=re.compile(r'/image/cache/'))]
            
            logger.info(f"AJAX: найдено {len(product_rows)} строк товаров на странице {page}")
            
            # Обрабатываем строки (используем ту же логику, что и в parse_catalog_page)
            for idx, row in enumerate(product_rows, 1):
                try:
                    img = row.find('img', src=re.compile(r'/image/cache/'))
                    if not img:
                        continue
                    
                    src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                    if not src:
                        continue
                    
                    original_url = normalize_image_url(src)
                    if not original_url:
                        continue
                    
                    # Извлекаем модель (та же логика)
                    model = None
                    model_cell = row.find('td', class_=lambda x: x and 'model' in str(x))
                    if model_cell:
                        link = model_cell.find('a', href=re.compile(r'/product/|route=product/product', re.I))
                        if link:
                            model = link.get('value')
                            if model:
                                model = model.strip()
                            if not model:
                                model = link.get_text(strip=True)
                                if model:
                                    model = re.sub(r'\s+', ' ', model).strip()
                    
                    if model:
                        # Пропускаем уже обработанные модели
                        if skip_processed and is_model_processed(model):
                            logger.debug(f"⏭️  Модель {model} уже обработана (AJAX), пропускаем")
                            continue
                        
                        if model not in products_images:
                            products_images[model] = []
                        if original_url not in products_images[model]:
                            # Пропускаем уже обработанные изображения
                            if skip_processed and is_image_processed(original_url):
                                logger.debug(f"⏭️  Изображение {original_url} уже обработано (AJAX), пропускаем")
                                continue
                            products_images[model].append(original_url)
                except Exception as e:
                    logger.debug(f"Ошибка обработки строки AJAX: {e}")
                    continue
            
            # Помечаем страницу как обработанную
            if products_images:
                mark_page_processed(page)
                save_parser_cache()
            
            return products_images
            
        except ValueError as e:
            logger.warning(f"AJAX ответ не является JSON для страницы {page}: {e}")
            return products_images
            
    except Exception as e:
        logger.error(f"Ошибка AJAX парсинга страницы {page}: {e}", exc_info=True)
        return products_images


def parse_catalog_page(page: int = 1, skip_processed: bool = True) -> Dict[str, List[str]]:
    """
    Парсит страницу каталога и извлекает ссылки на товары и их изображения
    
    Args:
        page: Номер страницы каталога
        skip_processed: Пропускать ли уже обработанные товары
        
    Returns:
        Словарь {model: [image_urls]}
    """
    products_images = {}
    
    # Проверяем, не обработана ли уже эта страница
    if skip_processed and is_page_processed(page):
        logger.info(f"⏭️  Страница {page} уже обработана, пропускаем")
        return products_images
    
    try:
        url = f"{PORTAL_URL}?sort=p.sort_order&order=ASC&page={page}"
        logger.info(f"📄 Парсинг страницы каталога {page}: {url}")
        
        # Используем сессию для сохранения cookies между запросами
        response = session.get(url, timeout=20)
        
        if response.status_code != 200:
            logger.warning(f"Не удалось загрузить страницу каталога {page}, статус: {response.status_code}")
            return products_images
        
        # Отладка: сохраняем HTML первой страницы для анализа
        if page == 1:
            debug_file = IMAGES_DIR.parent / f"debug_page_{page}.html"
            try:
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                logger.info(f"💾 HTML страницы {page} сохранен в {debug_file}")
                logger.info(f"📏 Размер ответа: {len(response.text)} символов")
            except Exception as e:
                logger.warning(f"Не удалось сохранить отладочный файл: {e}")
        
        # Отладка: сохраняем HTML первой страницы для анализа
        if page == 1:
            debug_file = IMAGES_DIR.parent / f"debug_page_{page}.html"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(response.text)
            logger.info(f"💾 HTML страницы {page} сохранен в {debug_file}")
            logger.info(f"📏 Размер ответа: {len(response.text)} символов")
        
        soup = BeautifulSoup(response.content, 'lxml')
        
        # Проверяем, что вообще есть в HTML
        if page == 1:
            all_tables = soup.find_all('table')
            all_tbody = soup.find_all('tbody')
            all_tr = soup.find_all('tr')
            all_img = soup.find_all('img')
            logger.info(f"🔍 Отладка страницы {page}: найдено {len(all_tables)} таблиц, {len(all_tbody)} tbody, {len(all_tr)} строк tr, {len(all_img)} изображений")
            
            # Проверяем наличие таблицы с id="myTable"
            mytable = soup.find('table', id=lambda x: x and 'myTable' in str(x))
            if mytable:
                logger.info(f"✓ Таблица myTable найдена")
                prods2 = mytable.find('tbody', id='prods2')
                if prods2:
                    logger.info(f"✓ tbody#prods2 найден, строк внутри: {len(prods2.find_all('tr'))}")
                else:
                    logger.warning(f"✗ tbody#prods2 не найден")
            else:
                logger.warning(f"✗ Таблица myTable не найдена")
            
            # Проверяем наличие изображений с /image/cache/
            cache_images = soup.find_all('img', src=re.compile(r'/image/cache/'))
            logger.info(f"🔍 Изображений с /image/cache/: {len(cache_images)}")
            if cache_images:
                logger.info(f"Примеры src: {[img.get('src') for img in cache_images[:3]]}")
        
        # Стратегия 1: Ищем строки таблицы с товарами (основная структура сайта)
        # Товары находятся в <tr class="product-layout product-grid noparent">
        # Ищем через классы (может быть несколько классов через пробел)
        product_rows = soup.find_all('tr', class_=lambda x: x and ('product-layout' in x or 'product-grid' in x))
        
        logger.debug(f"Найдено {len(product_rows)} строк через классы product-layout/product-grid")
        
        # Если не нашли через классы, ищем строки таблицы с изображениями товаров
        if not product_rows:
            # Ищем таблицу по id (может быть "myTable ajax-filter-container" - два значения)
            table = soup.find('table', id=lambda x: x and 'myTable' in str(x)) or \
                    soup.find('table', class_=lambda x: x and ('product-list' in str(x) or 'product-price' in str(x)))
            
            if table:
                logger.debug(f"Найдена таблица: id={table.get('id')}, class={table.get('class')}")
                # Ищем tbody с id="prods2" или любой tbody
                tbody = table.find('tbody', id='prods2') or \
                        table.find('tbody', id=lambda x: x and 'prods' in str(x)) or \
                        table.find('tbody')
                if tbody:
                    logger.debug(f"Найден tbody: id={tbody.get('id')}")
                    product_rows = tbody.find_all('tr')
                    # Фильтруем только строки с изображениями товаров
                    product_rows = [row for row in product_rows if row.find('img', src=re.compile(r'/image/cache/'))]
                    logger.debug(f"После фильтрации по изображениям: {len(product_rows)} строк")
        
        # Если все еще не нашли, ищем все tr с изображениями товаров
        if not product_rows:
            logger.debug("Поиск всех tr с изображениями товаров")
            all_rows = soup.find_all('tr')
            product_rows = [row for row in all_rows if row.find('img', src=re.compile(r'/image/cache/'))]
            logger.debug(f"Найдено {len(product_rows)} строк с изображениями")
        
        # Стратегия 2: Ищем все изображения товаров напрямую (fallback)
        images = soup.find_all('img', src=re.compile(r'/image/cache/'))
        logger.info(f"Найдено {len(images)} изображений и {len(product_rows)} строк товаров на странице {page}")
        
        # Обрабатываем строки таблицы с товарами
        logger.debug(f"Обработка {len(product_rows)} строк товаров")
        for idx, row in enumerate(product_rows, 1):
            try:
                # Ищем изображение в строке
                img = row.find('img', src=re.compile(r'/image/cache/'))
                if not img:
                    # Пробуем data-src или data-lazy-src для lazy loading
                    img = row.find('img', {'data-src': re.compile(r'/image/cache/')}) or \
                          row.find('img', {'data-lazy-src': re.compile(r'/image/cache/')})
                
                if not img:
                    logger.debug(f"Строка {idx}: не найдено изображение")
                    continue
                
                src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if not src:
                    logger.debug(f"Строка {idx}: изображение без src")
                    continue
                
                # Нормализуем URL к оригиналу
                original_url = normalize_image_url(src)
                if not original_url:
                    logger.debug(f"Строка {idx}: не удалось нормализовать URL {src}")
                    continue
                
                # Ищем модель товара
                model = None
                
                # Способ 1: Из атрибута value ссылки на товар (самый надежный для этого сайта)
                # Структура: <td class="model"><h4><a href="..." value="NVR501-16B">NVR501-16B</a></h4></td>
                model_cell = row.find('td', class_=lambda x: x and 'model' in str(x))
                if model_cell:
                    # Ищем ссылку - может быть /product/ или route=product/product
                    link = model_cell.find('a', href=re.compile(r'/product/|route=product/product', re.I))
                    if link:
                        # Приоритет 1: атрибут value (самый надежный)
                        model = link.get('value')
                        if model:
                            model = model.strip()
                            logger.debug(f"Строка {idx}: Модель из атрибута value: {model}")
                        
                        # Приоритет 2: текст ссылки (внутри <a>)
                        if not model:
                            model = link.get_text(strip=True)
                            # Убираем лишние пробелы и переносы строк
                            if model:
                                model = re.sub(r'\s+', ' ', model).strip()
                                logger.debug(f"Строка {idx}: Модель из текста ссылки: {model}")
                        
                        # Приоритет 3: из href (product_id или путь)
                        if not model:
                            product_url = link.get('href')
                            if product_url:
                                if not product_url.startswith('http'):
                                    product_url = urljoin(BASE_URL, product_url)
                                model = extract_model_from_url(product_url)
                                if model:
                                    logger.debug(f"Строка {idx}: Модель из URL: {model}")
                
                # Способ 2: Из текста ячейки модели (если не нашли через ссылку)
                if not model and model_cell:
                    # Ищем h4 внутри ячейки модели
                    h4 = model_cell.find('h4')
                    if h4:
                        model_text = h4.get_text(strip=True)
                    else:
                        model_text = model_cell.get_text(strip=True)
                    
                    # Очищаем от лишних символов и пробелов
                    model_text = re.sub(r'\s+', ' ', model_text).strip()
                    # Ищем модель в тексте
                    model = extract_model_from_text(model_text)
                
                # Способ 3: Из любой ссылки на товар в строке (route=product/product или /product/)
                if not model:
                    link = row.find('a', href=re.compile(r'/product/|route=product/product', re.I))
                    if link:
                        product_url = link.get('href')
                        if product_url:
                            if not product_url.startswith('http'):
                                product_url = urljoin(BASE_URL, product_url)
                            model = extract_model_from_url(product_url)
                            # Если не нашли из URL, пробуем текст ссылки
                            if not model:
                                model = link.get_text(strip=True)
                                if model:
                                    model = re.sub(r'\s+', ' ', model).strip()
                
                # Способ 4: Из всего текста строки (последний fallback)
                if not model:
                    row_text = row.get_text()
                    model = extract_model_from_text(row_text)
                
                if model:
                    # Пропускаем уже обработанные модели, если включен режим skip_processed
                    if skip_processed and is_model_processed(model):
                        logger.debug(f"⏭️  Модель {model} уже обработана, пропускаем")
                        continue
                    
                    if model not in products_images:
                        products_images[model] = []
                    if original_url not in products_images[model]:
                        # Пропускаем уже обработанные изображения
                        if skip_processed and is_image_processed(original_url):
                            logger.debug(f"⏭️  Изображение {original_url} уже обработано, пропускаем")
                            continue
                        products_images[model].append(original_url)
                        logger.debug(f"✓ Строка {idx}: Модель {model}: {original_url}")
                else:
                    logger.warning(f"⚠️  Строка {idx}: Найдено изображение {original_url}, но не удалось извлечь модель")
                    # Показываем структуру строки для отладки
                    model_cell = row.find('td', class_=re.compile(r'model', re.I))
                    if model_cell:
                        logger.debug(f"   Ячейка модели найдена: {model_cell.get_text(strip=True)[:100]}")
                    else:
                        logger.debug(f"   Ячейка модели не найдена")
            except Exception as e:
                logger.error(f"Ошибка при обработке строки товара {idx}: {e}", exc_info=True)
                continue
        
        # Обрабатываем изображения напрямую (fallback)
        for img in images:
            try:
                src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if not src:
                    continue
                
                original_url = normalize_image_url(src)
                if not original_url:
                    continue
                
                # Пытаемся найти модель из контекста изображения
                model = None
                
                # Ищем ссылку на товар (может быть /product/ или route=product/product)
                parent_link = img.find_parent('a', href=re.compile(r'/product/|route=product/product', re.I))
                if parent_link:
                    product_url = parent_link.get('href')
                    if product_url:
                        if not product_url.startswith('http'):
                            product_url = urljoin(BASE_URL, product_url)
                        model = extract_model_from_url(product_url)
                
                # Ищем в родительском элементе
                if not model:
                    parent = img.find_parent(['div', 'article', 'li', 'tr', 'td'])
                    if parent:
                        link = parent.find('a', href=re.compile(r'/product/|route=product/product', re.I))
                        if link:
                            # Проверяем атрибут value
                            model = link.get('value')
                            if model:
                                model = model.strip()
                            
                            # Если нет value, пробуем текст ссылки
                            if not model:
                                model = link.get_text(strip=True)
                                if model:
                                    model = re.sub(r'\s+', ' ', model).strip()
                            
                            # Если все еще нет, пробуем из URL
                            if not model:
                                product_url = link.get('href')
                                if product_url:
                                    if not product_url.startswith('http'):
                                        product_url = urljoin(BASE_URL, product_url)
                                    model = extract_model_from_url(product_url)
                        
                        # Если не нашли в ссылке, ищем в тексте
                        if not model:
                            text = parent.get_text()
                            model = extract_model_from_text(text)
                
                if model:
                    if model not in products_images:
                        products_images[model] = []
                    if original_url not in products_images[model]:
                        products_images[model].append(original_url)
            except Exception as e:
                logger.debug(f"Ошибка при обработке изображения: {e}")
                continue
        
        # Дополнительная проверка: если не нашли товаров, но есть изображения - это странно
        if not products_images and images:
            logger.warning(f"⚠️  На странице {page} найдено {len(images)} изображений, но не удалось извлечь модели товаров")
            logger.debug("Возможные причины: изменилась структура HTML или селекторы неверны")
        
        logger.info(f"✅ Найдено {len(products_images)} товаров с изображениями на странице {page}")
        
        # Помечаем страницу как обработанную
        if products_images:
            mark_page_processed(page)
            save_parser_cache()  # Сохраняем кэш после каждой страницы
        
        return products_images
        
    except Exception as e:
        logger.error(f"Ошибка при парсинге страницы каталога {page}: {e}", exc_info=True)
        return products_images


def login() -> bool:
    """
    Выполняет авторизацию на сайте
    
    Returns:
        True если авторизация успешна, False в противном случае
    """
    try:
        logger.info(f"🔐 Попытка авторизации на {LOGIN_URL}")
        
        # Сначала заходим на страницу логина для получения формы и CSRF токена
        login_page = session.get(LOGIN_URL, timeout=20)
        
        if login_page.status_code != 200:
            logger.error(f"Не удалось загрузить страницу логина, статус: {login_page.status_code}")
            return False
        
        soup = BeautifulSoup(login_page.content, 'lxml')
        
        # Ищем форму логина
        login_form = soup.find('form', {'action': re.compile(r'login', re.I)}) or \
                     soup.find('form', id=re.compile(r'login', re.I)) or \
                     soup.find('form')
        
        if not login_form:
            logger.error("Не найдена форма логина")
            return False
        
        # Определяем action формы
        form_action = login_form.get('action', '')
        logger.debug(f"Action формы: {form_action}")
        
        if form_action and not form_action.startswith('http'):
            if form_action.startswith('/'):
                login_post_url = f"{BASE_URL}{form_action}"
            else:
                login_post_url = urljoin(LOGIN_URL, form_action)
        elif not form_action:
            # Если action не указан, пробуем стандартные пути OpenCart
            login_post_url = f"{BASE_URL}/index.php?route=account/login"
        else:
            login_post_url = form_action
        
        logger.info(f"URL для POST запроса: {login_post_url}")
        
        # Подготавливаем данные для отправки
        # Ищем поля формы для телефона и пароля
        # Пробуем разные варианты поиска полей
        telephone_input = None
        password_input = None
        
        # Вариант 1: по name атрибуту
        for name_pattern in [r'telephone', r'phone', r'email', r'username', r'login']:
            telephone_input = login_form.find('input', {'name': re.compile(name_pattern, re.I)})
            if telephone_input:
                break
        
        # Вариант 2: по типу tel
        if not telephone_input:
            telephone_input = login_form.find('input', {'type': 'tel'})
        
        # Вариант 3: первый текстовый input
        if not telephone_input:
            all_text_inputs = login_form.find_all('input', {'type': 'text'})
            if all_text_inputs:
                telephone_input = all_text_inputs[0]
        
        password_input = login_form.find('input', {'type': 'password'})
        
        if not telephone_input or not password_input:
            logger.error("Не найдены поля формы для телефона или пароля")
            logger.debug(f"Найденные input поля: {[inp.get('name') or inp.get('type') for inp in login_form.find_all('input')]}")
            return False
        
        telephone_field = telephone_input.get('name', 'telephone')
        password_field = password_input.get('name', 'password')
        
        logger.info(f"Найдены поля: {telephone_field} и {password_field}")
        
        login_data = {
            telephone_field: LOGIN_USERNAME,
            password_field: LOGIN_PASSWORD,
        }
        
        logger.debug(f"Поля формы: {telephone_field}={LOGIN_USERNAME}, {password_field}=***")
        
        # Ищем скрытые поля формы (CSRF токены и т.д.)
        hidden_inputs = login_form.find_all('input', type='hidden')
        for hidden in hidden_inputs:
            name = hidden.get('name')
            value = hidden.get('value', '')
            if name:
                login_data[name] = value
                logger.debug(f"Добавлено скрытое поле: {name}")
        
        logger.info(f"📤 Отправка данных авторизации на {login_post_url}")
        
        # Отправляем POST запрос для авторизации
        login_response = session.post(
            login_post_url,
            data=login_data,
            timeout=20,
            allow_redirects=True
        )
        
        # Проверяем успешность авторизации
        logger.info(f"Статус ответа: {login_response.status_code}")
        logger.info(f"Финальный URL: {login_response.url}")
        logger.info(f"Cookies после логина: {list(session.cookies.keys())}")
        
        # Проверяем cookies - если есть сессионные cookies, значит авторизация прошла
        session_cookies = [name for name in session.cookies.keys() if 'session' in name.lower() or 'oc_session' in name.lower() or 'PHPSESSID' in name or 'OCSESSID' in name]
        
        # Проверяем, что мы не на странице логина
        final_url_lower = login_response.url.lower()
        is_on_login_page = 'login' in final_url_lower
        
        if login_response.status_code in [200, 302, 301]:
            # Если есть сессионные cookies ИЛИ нас перенаправило не на логин - считаем успешным
            if len(session_cookies) > 0 or not is_on_login_page:
                logger.info(f"✓ Авторизация успешна, редирект на: {login_response.url}")
                logger.info(f"✓ Найдено сессионных cookies: {len(session_cookies)}")
                
                # Дополнительная проверка: пробуем зайти на портал
                logger.info("🔍 Проверка доступа к порталу...")
                test_response = session.get(PORTAL_URL, timeout=10)
                logger.info(f"Статус портала: {test_response.status_code}, URL: {test_response.url}")
                
                if test_response.status_code == 200:
                    # Проверяем, что на странице есть товары (не редирект на логин)
                    test_url_lower = test_response.url.lower()
                    if 'login' not in test_url_lower:
                        # Проверяем наличие товаров на странице
                        test_soup = BeautifulSoup(test_response.content, 'lxml')
                        product_rows = test_soup.find_all('tr', class_=lambda x: x and ('product-layout' in x or 'product-grid' in x))
                        if product_rows:
                            logger.info(f"✓ Подтвержден доступ к порталу, найдено {len(product_rows)} товаров")
                            return True
                        else:
                            logger.warning("⚠️  Доступ к порталу есть, но товары не найдены")
                            # Сохраняем HTML для отладки
                            debug_file = IMAGES_DIR.parent / "debug_portal_after_login.html"
                            with open(debug_file, 'w', encoding='utf-8') as f:
                                f.write(test_response.text)
                            logger.info(f"💾 HTML портала сохранен в {debug_file}")
                            return True  # Возвращаем True, так как доступ есть
                    else:
                        logger.warning("⚠️  Редирект на логин при проверке доступа к порталу")
                        return False
                else:
                    logger.warning(f"⚠️  Не удалось проверить доступ к порталу, статус: {test_response.status_code}")
                    # Если есть cookies, считаем авторизацию успешной
                    if len(session_cookies) > 0:
                        logger.info("✓ Есть сессионные cookies, считаем авторизацию успешной")
                        return True
                    return False
            else:
                # Проверяем наличие сообщения об ошибке
                soup_response = BeautifulSoup(login_response.content, 'lxml')
                error_msg = soup_response.find('div', class_=re.compile(r'alert|error|danger|warning', re.I))
                if error_msg:
                    error_text = error_msg.get_text(strip=True)
                    logger.error(f"✗ Ошибка авторизации: {error_text}")
                else:
                    logger.warning("⚠️  Не удалось определить статус авторизации")
                    logger.debug(f"URL ответа: {login_response.url}")
                    logger.debug(f"Cookies в сессии: {list(session.cookies.keys())}")
                    # Сохраняем HTML для отладки
                    debug_file = IMAGES_DIR.parent / "debug_login_response.html"
                    with open(debug_file, 'w', encoding='utf-8') as f:
                        f.write(login_response.text)
                    logger.info(f"💾 HTML ответа логина сохранен в {debug_file}")
                return False
        else:
            logger.error(f"✗ Ошибка авторизации, статус: {login_response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Ошибка при авторизации: {e}", exc_info=True)
        return False


def parse_catalog(max_pages: Optional[int] = None, skip_processed: bool = True) -> Dict[str, List[str]]:
    """
    Парсит весь каталог товаров
    
    Args:
        max_pages: Максимальное количество страниц (None = все)
        skip_processed: Пропускать ли уже обработанные товары и страницы
        
    Returns:
        Словарь {model: [image_urls]}
    """
    # Загружаем кэш при старте парсинга
    load_parser_cache()
    
    all_products_images = {}
    page = 1
    empty_pages = 0
    max_empty_pages = 5  # Увеличено до 5 пустых страниц подряд
    
    logger.info(f"🚀 Начало парсинга каталога (max_pages={max_pages}, skip_processed={skip_processed})")
    logger.info(f"📊 В кэше: {len(_parser_cache['processed_models'])} моделей, "
              f"{len(_parser_cache['processed_images'])} изображений, "
              f"{len(_parser_cache['processed_pages'])} страниц")
    
    # Инициализация сессии: заходим на главную страницу для получения cookies
    try:
        logger.info(f"🔐 Инициализация сессии: заход на главную страницу...")
        init_response = session.get(BASE_URL, timeout=20)
        if init_response.status_code == 200:
            logger.info(f"✓ Сессия инициализирована, получены cookies")
        else:
            logger.warning(f"⚠️  Не удалось инициализировать сессию, статус: {init_response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️  Ошибка инициализации сессии: {e}")
    
    # Выполняем авторизацию
    if not login():
        logger.error("❌ Не удалось авторизоваться. Парсинг невозможен без авторизации.")
        return all_products_images
    
    logger.info("✅ Авторизация успешна, начинаем парсинг...")
    
    while True:
        if max_pages and page > max_pages:
            logger.info(f"Достигнут лимит страниц: {max_pages}")
            break
        
        # Пробуем сначала AJAX, если не получится - обычный парсинг
        products_images = parse_catalog_page_ajax(page, skip_processed=skip_processed)
        
        # Если AJAX не вернул результатов, пробуем обычный парсинг
        if not products_images:
            logger.info(f"AJAX не вернул результатов, пробуем обычный парсинг страницы {page}")
            products_images = parse_catalog_page(page, skip_processed=skip_processed)
        
        # Страница считается пустой только если:
        # 1. Нет товаров с изображениями И
        # 2. Это не первая страница (первая может быть пустой из-за ошибок)
        if not products_images:
            empty_pages += 1
            logger.warning(f"⚠️  Страница {page}: не найдено товаров с изображениями ({empty_pages}/{max_empty_pages})")
            
            # Проверяем, действительно ли страница пустая (может быть проблема с парсингом)
            if empty_pages >= max_empty_pages:
                logger.info(f"Найдено {empty_pages} пустых страниц подряд, остановка парсинга")
                logger.info(f"Возможно, достигнут конец каталога или возникла проблема с парсингом")
                logger.info(f"Проверьте логи выше для диагностики проблемы")
                break
        else:
            empty_pages = 0
            # Объединяем результаты
            for model, urls in products_images.items():
                if model not in all_products_images:
                    all_products_images[model] = []
                for url in urls:
                    if url not in all_products_images[model]:
                        all_products_images[model].append(url)
            
            logger.info(f"📦 Страница {page}: найдено {len(products_images)} товаров, всего собрано {len(all_products_images)}")
            
            # Сохраняем кэш после каждой страницы с результатами
            save_parser_cache()
        
        page += 1
        
        # Задержка между запросами
        if page <= max_pages if max_pages else True:
            time.sleep(REQUEST_DELAY)
    
    logger.info(f"✅ Парсинг каталога завершен. Найдено {len(all_products_images)} товаров")
    
    # Подсчитываем общее количество изображений
    total_images = sum(len(urls) for urls in all_products_images.values())
    logger.info(f"📊 Статистика: {len(all_products_images)} товаров, {total_images} изображений")
    
    # Финальное сохранение кэша
    save_parser_cache()
    
    return all_products_images


def normalize_model_name(model: str) -> str:
    """
    Нормализует название модели для лучшего сопоставления
    
    Args:
        model: Название модели товара
        
    Returns:
        Нормализованное название модели
    """
    if not model:
        return ""
    
    # Убираем лишние пробелы и приводим к верхнему регистру
    normalized = model.strip().upper()
    
    # Убираем специальные символы, которые могут мешать сопоставлению
    # Но сохраняем дефисы и слеши, так как они могут быть частью модели
    normalized = re.sub(r'\s+', '', normalized)  # Убираем все пробелы
    
    return normalized


def download_images_for_products(products_images: Dict[str, List[str]], download_immediately: bool = True) -> Dict[str, int]:
    """
    Скачивает изображения для всех товаров
    
    Args:
        products_images: Словарь {model: [image_urls]}
        download_immediately: Если True, скачивает изображения сразу, иначе только возвращает статистику
        
    Returns:
        Словарь {model: количество_скачанных_изображений}
    """
    downloaded = {}
    total_images = sum(len(urls) for urls in products_images.values())
    processed = 0
    
    logger.info(f"📥 Начало скачивания {total_images} изображений для {len(products_images)} товаров")
    
    for model, image_urls in products_images.items():
        # Нормализуем название модели для единообразия
        normalized_model = normalize_model_name(model)
        # Используем оригинальное название для папки (чтобы сохранить точное соответствие)
        model_dir = IMAGES_DIR / model
        model_dir.mkdir(parents=True, exist_ok=True)
        
        downloaded_count = 0
        skipped_count = 0
        
        # Проверяем, есть ли уже изображения для этой модели
        existing_images = list(model_dir.glob("*.*")) if model_dir.exists() else []
        if existing_images:
            logger.debug(f"Модель {model}: уже есть {len(existing_images)} изображений")
        
        for image_url in image_urls:
            # Пропускаем уже обработанные изображения
            if is_image_processed(image_url):
                skipped_count += 1
                continue
            # Извлекаем имя файла из URL
            parsed_url = urlparse(image_url)
            filename = Path(parsed_url.path).name
            
            # Если имя файла пустое, генерируем из URL
            if not filename or '.' not in filename:
                # Пытаемся извлечь из URL
                match = re.search(r'/(\d+_\d+\.(jpg|jpeg|png|webp))', image_url)
                if match:
                    filename = match.group(1)
                else:
                    # Генерируем имя из хэша URL
                    import hashlib
                    url_hash = hashlib.md5(image_url.encode()).hexdigest()[:8]
                    filename = f"{url_hash}.jpg"
            
            save_path = model_dir / filename
            
            if download_immediately:
                if download_image(image_url, save_path, check_cache=True):
                    downloaded_count += 1
                    # Помечаем модель как обработанную после успешного скачивания первого изображения
                    if downloaded_count == 1:
                        mark_model_processed(model)
            else:
                # Только проверяем существование
                if save_path.exists():
                    downloaded_count += 1
                    mark_image_processed(image_url)
            
            processed += 1
            if processed % 10 == 0:
                logger.info(f"Прогресс: {processed}/{total_images} изображений обработано (пропущено: {skipped_count})")
            
            # Задержка между скачиваниями
            if download_immediately:
                time.sleep(REQUEST_DELAY)
        
        # Сохраняем кэш после обработки каждой модели
        if download_immediately and downloaded_count > 0:
            save_parser_cache()
        
        downloaded[model] = downloaded_count
        if skipped_count > 0:
            logger.info(f"✓ Модель {model}: {'скачано' if download_immediately else 'найдено'} {downloaded_count}/{len(image_urls)} изображений (пропущено: {skipped_count})")
        else:
            logger.info(f"✓ Модель {model}: {'скачано' if download_immediately else 'найдено'} {downloaded_count}/{len(image_urls)} изображений")
    
    logger.info(f"✅ Скачивание завершено. Всего обработано {processed} изображений")
    return downloaded


def main():
    """Основная функция для запуска парсера"""
    logger.info("=" * 60)
    logger.info("ПАРСЕР ИЗОБРАЖЕНИЙ ТОВАРОВ complex.com.kz")
    logger.info("=" * 60)
    
    # Загружаем кэш при старте
    load_parser_cache()
    
    # Парсим каталог (None = все страницы, skip_processed=True - пропускаем уже обработанные)
    products_images = parse_catalog(max_pages=None, skip_processed=True)
    
    if not products_images:
        logger.warning("Не найдено товаров с изображениями")
        return
    
    logger.info(f"\nНайдено {len(products_images)} товаров с изображениями:")
    for model, urls in list(products_images.items())[:10]:  # Показываем первые 10
        logger.info(f"  {model}: {len(urls)} изображений")
    
    # Скачиваем изображения
    downloaded = download_images_for_products(products_images)
    
    logger.info("\n" + "=" * 60)
    logger.info("РЕЗУЛЬТАТЫ:")
    logger.info("=" * 60)
    total_downloaded = sum(downloaded.values())
    logger.info(f"Всего скачано изображений: {total_downloaded}")
    logger.info(f"Товаров обработано: {len(downloaded)}")
    logger.info(f"Директория с изображениями: {IMAGES_DIR.absolute()}")
    logger.info(f"Кэш парсера сохранен в: {PARSER_CACHE_FILE}")


if __name__ == "__main__":
    main()
