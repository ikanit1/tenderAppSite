"""Модуль управления видимостью товаров в каталоге.

Позволяет скрывать товары из выдачи /products по бренду или по модели.
Данные хранятся в data/visibility.json (отдельно от цен — prices.json).
"""
import json
import logging
from pathlib import Path
from typing import Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)

VISIBILITY_FILE = Path(__file__).parent / "data" / "visibility.json"
VISIBILITY_FILE.parent.mkdir(exist_ok=True)

# Структура данных:
# {
#     "hidden_brands": ["IEK", "Schneider Electric"],  # бренды, скрытые целиком
#     "hidden_models": ["LC1D25M7"],                   # точечные исключения по модели
#     "updated": "2026-05-14T12:00:00"
# }


def load_visibility() -> Dict:
    """Загружает настройки видимости из файла."""
    try:
        if VISIBILITY_FILE.exists():
            with open(VISIBILITY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "hidden_brands" not in data:
                    data["hidden_brands"] = []
                if "hidden_models" not in data:
                    data["hidden_models"] = []
                return data
    except Exception as e:
        logger.warning(f"Не удалось загрузить настройки видимости: {e}")

    return {
        "hidden_brands": [],
        "hidden_models": [],
        "updated": datetime.now().isoformat(),
    }


def save_visibility(data: Dict) -> bool:
    """Сохраняет настройки видимости в файл."""
    try:
        data["updated"] = datetime.now().isoformat()
        VISIBILITY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(VISIBILITY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Настройки видимости сохранены")
        return True
    except Exception as e:
        logger.error(f"Ошибка сохранения настроек видимости: {e}")
        return False


def get_visibility() -> Dict:
    """Возвращает все настройки видимости."""
    return load_visibility()


def is_product_hidden(model: str, brand: str) -> bool:
    """Проверяет, скрыт ли товар (по бренду или по модели)."""
    data = load_visibility()
    model_norm = (model or "").strip().lower()
    brand_norm = (brand or "").strip().lower()
    if brand_norm and brand_norm in {b.strip().lower() for b in data.get("hidden_brands", [])}:
        return True
    if model_norm and model_norm in {m.strip().lower() for m in data.get("hidden_models", [])}:
        return True
    return False


def filter_visible(products: List[Dict]) -> List[Dict]:
    """Возвращает список товаров без скрытых (по бренду/модели)."""
    data = load_visibility()
    hidden_brands = {b.strip().lower() for b in data.get("hidden_brands", [])}
    hidden_models = {m.strip().lower() for m in data.get("hidden_models", [])}
    if not hidden_brands and not hidden_models:
        return products
    result = []
    for p in products:
        brand = (p.get("brand") or "").strip().lower()
        model = (p.get("model") or "").strip().lower()
        if brand and brand in hidden_brands:
            continue
        if model and model in hidden_models:
            continue
        result.append(p)
    return result


def add_hidden_brand(brand: str) -> bool:
    """Добавляет бренд в список скрытых."""
    brand = (brand or "").strip()
    if not brand:
        raise ValueError("Бренд не может быть пустым")
    data = load_visibility()
    existing = {b.strip().lower() for b in data["hidden_brands"]}
    if brand.lower() not in existing:
        data["hidden_brands"].append(brand)
    return save_visibility(data)


def remove_hidden_brand(brand: str) -> bool:
    """Убирает бренд из списка скрытых."""
    data = load_visibility()
    data["hidden_brands"] = [
        b for b in data["hidden_brands"] if b.strip().lower() != (brand or "").strip().lower()
    ]
    return save_visibility(data)


def add_hidden_model(model: str) -> bool:
    """Добавляет модель в список скрытых."""
    model = (model or "").strip()
    if not model:
        raise ValueError("Модель не может быть пустой")
    data = load_visibility()
    existing = {m.strip().lower() for m in data["hidden_models"]}
    if model.lower() not in existing:
        data["hidden_models"].append(model)
    return save_visibility(data)


def remove_hidden_model(model: str) -> bool:
    """Убирает модель из списка скрытых."""
    data = load_visibility()
    data["hidden_models"] = [
        m for m in data["hidden_models"] if m.strip().lower() != (model or "").strip().lower()
    ]
    return save_visibility(data)
