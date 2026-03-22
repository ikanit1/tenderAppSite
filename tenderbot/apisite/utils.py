"""Утилиты для работы с изображениями товаров"""
from typing import Optional
import hashlib
import re
import urllib.parse


# Кириллические буквы, похожие на латинские (в артикулах часто ошибочно)
_CYRILLIC_TO_LATIN = str.maketrans({
    "Н": "H", "н": "h",  # DHI-NVR1104HS-P-S3/Н → /H
    "А": "A", "а": "a", "В": "B", "Е": "E", "К": "K", "М": "M",
    "О": "O", "о": "o", "Р": "P", "С": "C", "Т": "T", "Х": "X",
})


def normalize_model_for_fs(model: str) -> str:
    """Нормализует модель для сопоставления с папками: кириллица → латиница."""
    if not model or not isinstance(model, str):
        return ""
    return model.translate(_CYRILLIC_TO_LATIN)


def get_clean_id(text: str) -> str:
    """
    «Слепое» сопоставление: только буквы и цифры, нижний регистр.
    KIT/XVR301-04G3 и KIT_XVR301_04G3 → один ключ kitxvr30104g3.
    """
    if not text or not isinstance(text, str):
        return ""
    return re.sub(r"[^a-zA-Z0-9]", "", text).lower()


def model_to_foldername(model: str, max_len: int = 120) -> str:
    """
    Единое правило: модель из API/B2B (с / и др.) → имя папки в portal_export.
    Недопустимые для FS символы [<>:"/\\|?*] заменяются на _. Кириллица → латиница.
    """
    if not model or not isinstance(model, str):
        return "product"
    s = normalize_model_for_fs(model)
    s = re.sub(r'[<>:"/\\|?*]', "_", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len] if s else "product"


def generate_product_image_url(product: dict) -> Optional[str]:
    """
    Генерирует URL изображения товара
    
    Стратегии:
    1. Если есть поле image в данных - используем его
    2. Генерируем уникальный URL на основе бренда и модели
    3. Используем placeholder с информацией о товаре
    """
    # Если есть изображение в данных
    if product.get('image'):
        return product['image']
    
    # Генерируем уникальный URL на основе бренда и модели
    brand = product.get('brand', 'Product')
    model = product.get('model', '')
    name = product.get('name', '')
    
    # Создаем уникальный идентификатор для товара
    product_id = f"{brand}_{model}".replace(' ', '_').replace('/', '_')
    hash_input = f"{brand}{model}{name}".encode('utf-8')
    color_hash = hashlib.md5(hash_input).hexdigest()[:6]
    
    # Используем более информативный текст
    display_text = f"{brand} {model}"[:25]
    if len(display_text) < len(f"{brand} {model}"):
        display_text += "..."
    
    # Кодируем текст для URL
    encoded_text = urllib.parse.quote(display_text)
    
    # Используем placeholder с уникальным цветом для каждого товара
    # Размер оптимизирован для быстрой загрузки
    return f"https://via.placeholder.com/400x250/{color_hash}/ffffff?text={encoded_text}"


def get_brand_color(brand: str) -> str:
    """Получает цвет для бренда"""
    colors = {
        'Dahua': '#667eea',
        'Hikvision': '#f093fb',
        'Samsung': '#4facfe',
        'LG': '#43e97b',
        'Sony': '#fa709a',
    }
    return colors.get(brand, '#667eea')
