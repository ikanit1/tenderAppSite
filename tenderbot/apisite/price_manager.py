"""Модуль для управления ценами и скидками"""
import json
import logging
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

# Файл для хранения настроек цен и скидок
PRICES_FILE = Path(__file__).parent / "data" / "prices.json"
PRICES_FILE.parent.mkdir(exist_ok=True)

# Структура данных для хранения цен:
# {
#     "global_discount": 0.0,  # Глобальная скидка в процентах (0-100)
#     "model_discounts": {   # Скидки по конкретным моделям
#         "MODEL1": 10.0,    # Скидка 10% для MODEL1
#         "MODEL2": 15.0     # Скидка 15% для MODEL2
#     },
#     "brand_discounts": {   # Скидки по брендам
#         "Dahua": 5.0,      # Скидка 5% для всех товаров Dahua
#         "Hikvision": 8.0   # Скидка 8% для всех товаров Hikvision
#     },
#     "custom_prices": {     # Кастомные цены для конкретных моделей
#         "MODEL1": 25000.0  # Фиксированная цена для MODEL1
#     },
#     "updated": "2026-02-09T12:00:00"
# }


def load_prices() -> Dict:
    """Загружает настройки цен из файла"""
    try:
        if PRICES_FILE.exists():
            with open(PRICES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Проверяем структуру и добавляем недостающие поля
                if "global_discount" not in data:
                    data["global_discount"] = 0.0
                if "model_discounts" not in data:
                    data["model_discounts"] = {}
                if "brand_discounts" not in data:
                    data["brand_discounts"] = {}
                if "custom_prices" not in data:
                    data["custom_prices"] = {}
                return data
    except Exception as e:
        logger.warning(f"Не удалось загрузить настройки цен: {e}")
    
    # Возвращаем структуру по умолчанию
    return {
        "global_discount": 0.0,
        "model_discounts": {},
        "brand_discounts": {},
        "custom_prices": {},
        "updated": datetime.now().isoformat()
    }


def save_prices(prices_data: Dict) -> bool:
    """Сохраняет настройки цен в файл"""
    try:
        prices_data["updated"] = datetime.now().isoformat()
        PRICES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(PRICES_FILE, 'w', encoding='utf-8') as f:
            json.dump(prices_data, f, ensure_ascii=False, indent=2)
        logger.info("Настройки цен сохранены")
        return True
    except Exception as e:
        logger.error(f"Ошибка сохранения настроек цен: {e}")
        return False


def calculate_final_price(price_rrc: float, model: str = "", brand: str = "") -> Dict:
    """
    Рассчитывает итоговую цену с учетом всех скидок
    
    Args:
        price_rrc: Розничная цена
        model: Модель товара
        brand: Бренд товара
        
    Returns:
        Dict с полями:
        - final_price: Итоговая цена
        - discount: Процент скидки
        - discount_amount: Сумма скидки
        - original_price: Исходная цена (price_rrc)
    """
    # Нормализуем входные данные
    try:
        price_rrc = float(price_rrc) if price_rrc is not None else 0.0
        if price_rrc < 0:
            price_rrc = 0.0
    except (ValueError, TypeError):
        price_rrc = 0.0
    
    model = str(model) if model else ""
    brand = str(brand) if brand else ""
    
    prices_data = load_prices()
    
    # Проверяем кастомную цену (приоритет 1)
    if model and model in prices_data.get("custom_prices", {}):
        custom_price = prices_data["custom_prices"][model]
        discount_amount = price_rrc - custom_price
        discount_percent = (discount_amount / price_rrc * 100) if price_rrc > 0 else 0
        return {
            "final_price": custom_price,
            "discount": round(discount_percent, 2),
            "discount_amount": round(discount_amount, 2),
            "original_price": price_rrc
        }
    
    # Применяем скидки (приоритет: модель > бренд > глобальная)
    # Глобальная скидка применяется ко всем товарам, если не установлена индивидуальная
    discount_percent = prices_data.get("global_discount", 0.0)
    
    # Скидка по модели (приоритет 1 - переопределяет глобальную)
    if model and model in prices_data.get("model_discounts", {}):
        discount_percent = prices_data["model_discounts"][model]
    # Скидка по бренду (приоритет 2 - переопределяет глобальную, но не модель)
    elif brand and brand in prices_data.get("brand_discounts", {}):
        discount_percent = prices_data["brand_discounts"][brand]
    # Если нет индивидуальных скидок, используется глобальная (уже установлена выше)
    
    # Рассчитываем итоговую цену
    discount_amount = price_rrc * (discount_percent / 100)
    final_price = price_rrc - discount_amount
    
    return {
        "final_price": round(final_price, 2),
        "discount": round(discount_percent, 2),
        "discount_amount": round(discount_amount, 2),
        "original_price": price_rrc
    }


def set_global_discount(discount: float) -> bool:
    """Устанавливает глобальную скидку (0-100%)"""
    if discount < 0 or discount > 100:
        raise ValueError("Скидка должна быть в диапазоне 0-100%")
    
    prices_data = load_prices()
    prices_data["global_discount"] = discount
    return save_prices(prices_data)


def set_model_discount(model: str, discount: float) -> bool:
    """Устанавливает скидку для конкретной модели"""
    if discount < 0 or discount > 100:
        raise ValueError("Скидка должна быть в диапазоне 0-100%")
    
    prices_data = load_prices()
    if "model_discounts" not in prices_data:
        prices_data["model_discounts"] = {}
    prices_data["model_discounts"][model] = discount
    return save_prices(prices_data)


def remove_model_discount(model: str) -> bool:
    """Удаляет скидку для конкретной модели"""
    prices_data = load_prices()
    if "model_discounts" in prices_data and model in prices_data["model_discounts"]:
        del prices_data["model_discounts"][model]
        return save_prices(prices_data)
    return True


def set_brand_discount(brand: str, discount: float) -> bool:
    """Устанавливает скидку для бренда"""
    if discount < 0 or discount > 100:
        raise ValueError("Скидка должна быть в диапазоне 0-100%")
    
    prices_data = load_prices()
    if "brand_discounts" not in prices_data:
        prices_data["brand_discounts"] = {}
    prices_data["brand_discounts"][brand] = discount
    return save_prices(prices_data)


def remove_brand_discount(brand: str) -> bool:
    """Удаляет скидку для бренда"""
    prices_data = load_prices()
    if "brand_discounts" in prices_data and brand in prices_data["brand_discounts"]:
        del prices_data["brand_discounts"][brand]
        return save_prices(prices_data)
    return True


def set_custom_price(model: str, price: float) -> bool:
    """Устанавливает кастомную цену для модели"""
    if price < 0:
        raise ValueError("Цена не может быть отрицательной")
    
    prices_data = load_prices()
    if "custom_prices" not in prices_data:
        prices_data["custom_prices"] = {}
    prices_data["custom_prices"][model] = price
    return save_prices(prices_data)


def remove_custom_price(model: str) -> bool:
    """Удаляет кастомную цену для модели"""
    prices_data = load_prices()
    if "custom_prices" in prices_data and model in prices_data["custom_prices"]:
        del prices_data["custom_prices"][model]
        return save_prices(prices_data)
    return True


def get_all_discounts() -> Dict:
    """Возвращает все настройки скидок"""
    return load_prices()
