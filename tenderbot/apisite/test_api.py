"""
Скрипт для тестирования API.

Проверка сопоставления папок (модель с / → папка с _ или -):
  - Запустить API: python main.py
  - Запустить тесты: python test_api.py
  - В админке http://localhost:8000/admin.html → «Проверка недостающих позиций» → «Проверить»

Кэш/очистка:
  - Кэш B2B (список товаров): обновляется по таймеру или при перезапуске API. Чистить вручную не нужно.
  - Индекс portal_export (clean_id → папка): строится при первом запросе, сбрасывается только перезапуском API.
    Если добавили новые папки в portal_export — перезапустите main.py.
  - Куки: используются только парсерами портала (portal_parser_cannon и др.), на поиск папок API не влияют.
"""
import requests
import json
from typing import Optional


BASE_URL = "http://localhost:8000"


def test_root():
    """Тест корневого эндпоинта"""
    print("\n=== Тест корневого эндпоинта ===")
    response = requests.get(f"{BASE_URL}/")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.status_code == 200


def test_health():
    """Тест health check"""
    print("\n=== Тест health check ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.status_code == 200


def test_products_all():
    """Тест получения всех товаров"""
    print("\n=== Тест получения всех товаров ===")
    response = requests.get(f"{BASE_URL}/products")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Обновлено: {data.get('updated')}")
    print(f"Количество товаров: {data.get('count')}")
    if data.get('products'):
        print(f"Первый товар: {json.dumps(data['products'][0], indent=2, ensure_ascii=False)}")
    return response.status_code == 200


def test_products_filter_brand(brand: str = "Dahua"):
    """Тест фильтрации по бренду"""
    print(f"\n=== Тест фильтрации по бренду: {brand} ===")
    response = requests.get(f"{BASE_URL}/products", params={"brand": brand})
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Найдено товаров: {data.get('count')}")
    if data.get('products'):
        print(f"Пример товара: {json.dumps(data['products'][0], indent=2, ensure_ascii=False)}")
    return response.status_code == 200


def test_products_search(search: str = "IPC"):
    """Тест поиска"""
    print(f"\n=== Тест поиска: {search} ===")
    response = requests.get(f"{BASE_URL}/products", params={"search": search})
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Найдено товаров: {data.get('count')}")
    if data.get('products'):
        print(f"Пример товара: {json.dumps(data['products'][0], indent=2, ensure_ascii=False)}")
    return response.status_code == 200


def test_products_min_quantity(min_qty: int = 10):
    """Тест фильтрации по минимальному количеству"""
    print(f"\n=== Тест фильтрации по минимальному количеству: {min_qty} ===")
    response = requests.get(f"{BASE_URL}/products", params={"min_quantity": min_qty})
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Найдено товаров: {data.get('count')}")
    return response.status_code == 200


def test_product_by_model(model: str = "IPC-HFW1230"):
    """Тест получения товара по модели"""
    print(f"\n=== Тест получения товара по модели: {model} ===")
    response = requests.get(f"{BASE_URL}/products/{model}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Товар: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    else:
        print(f"Ошибка: {response.text}")
    return response.status_code in [200, 404]


def test_portal_mismatch():
    """Проверка недостающих позиций: товары без папки в portal_export"""
    print("\n=== Проверка недостающих позиций (portal_export) ===")
    response = requests.get(f"{BASE_URL}/api/admin/portal-mismatch")
    print(f"Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Ошибка: {response.text}")
        return False
    data = response.json()
    total = data.get("total_products", 0)
    missing_count = data.get("missing_count", 0)
    missing = data.get("missing", [])
    print(f"Товаров всего: {total}, без папки: {missing_count}")
    if missing:
        print("Примеры (первые 3):")
        for row in missing[:3]:
            print(f"  Модель: {row.get('model')} → ожидаемая папка: {row.get('expected_folder')}")
    else:
        print("Все товары имеют папку в portal_export (или список товаров пуст).")
    return True


def test_product_detail_slash_model(model: str = "DHI-NVR1104HS-P-S3/H"):
    """
    Проверка, что модель с «/» в названии находит папку с «_» (или «-»).
    Успех: 200 и в ответе есть images и/или description, если папка есть.
    """
    print(f"\n=== Тест detail для модели с /: {model} ===")
    encoded = requests.utils.quote(model, safe="")
    response = requests.get(f"{BASE_URL}/api/products/{encoded}/detail")
    print(f"Status: {response.status_code}")
    if response.status_code == 404:
        print("Товар не найден (нет в B2B или кэш пуст). Запустите обновление данных.")
        return True  # не падаем, если просто нет такого товара
    if response.status_code != 200:
        print(f"Ошибка: {response.text}")
        return False
    data = response.json()
    images = data.get("images") or []
    desc = (data.get("description") or "").strip()
    print(f"Модель в ответе: {data.get('model')}")
    print(f"Картинок из portal_export: {len(images)}")
    print(f"Описание (длина): {len(desc)} символов")
    if images or desc:
        print("OK: папка для модели с «/» найдена (данные из portal_export).")
    else:
        print("Папка не найдена или пуста — проверьте, что в portal_export есть папка с _ вместо / (напр. DHI-NVR1104HS-P-S3_H).")
    return True


def main():
    """Запуск всех тестов"""
    print("=" * 60)
    print("Тестирование B2B Products API")
    print("=" * 60)
    
    try:
        # Проверка доступности сервера
        test_root()
        
        # Health check
        test_health()
        
        # Получение всех товаров
        test_products_all()
        
        # Фильтры
        test_products_filter_brand()
        test_products_search()
        test_products_min_quantity()
        
        # Получение по модели (может не найти, если такого товара нет)
        test_product_by_model()
        
        # Проверка сопоставления папок: недостающие позиции и модель с /
        test_portal_mismatch()
        test_product_detail_slash_model()
        
        print("\n" + "=" * 60)
        print("Тестирование завершено!")
        print("Если добавили папки в portal_export — перезапустите API (python main.py).")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("\n[ОШИБКА] Сервер не запущен!")
        print("Запустите сервер командой: python main.py")
    except Exception as e:
        print(f"\n[ОШИБКА] {e}")


if __name__ == "__main__":
    main()
