#!/usr/bin/env python3
"""
Клиент SATU.KZ Public API.

Документация: https://public-api.docs.satu.kz/
- Products: список товаров, редактирование (products/list, products/edit, products/import_file)
- Orders: список заказов, смена статуса (orders/list, orders/set_status; OrderStatus)
- Clients, Messages, Groups, Payment, Delivery, Chat

Важно: все данные для товаров (название, описание, цена, артикул) и изображения
должны браться только из portal_export (папки с product.json, name.txt, description.txt, image_*.jpg).
В API передаётся только то, что загружено из portal_export.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_apisite_dir = Path(__file__).resolve().parent


def _get_config():
    import sys
    if str(_apisite_dir) not in sys.path:
        sys.path.insert(0, str(_apisite_dir))
    from config import SATU_API_BASE_URL, SATU_API_TOKEN
    return SATU_API_BASE_URL, SATU_API_TOKEN


def request(method: str, path: str, token: str, *, json_data: dict | None = None, files: dict | None = None, data: dict | None = None, timeout: int = 60):
    """Выполняет HTTP-запрос к SATU API. path — без ведущего слэша."""
    import requests
    base_url, _ = _get_config()
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {"Authorization": f"Bearer {token}"}
    if files or data:
        return requests.request(method, url, headers=headers, data=data, files=files, timeout=timeout)
    return requests.request(method, url, headers=headers, json=json_data or {}, timeout=timeout)


def check_auth(token: str) -> bool:
    """Проверяет токен запросом GET /products/list."""
    if not token:
        return False
    try:
        resp = request("GET", "products/list", token, json_data=None)
        if resp.status_code == 200:
            logger.info("Токен SATU проверен, API доступен.")
            return True
        logger.warning("SATU API ответ: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:
        logger.warning("Ошибка проверки SATU API: %s", e)
        return False


def product_edit(token: str, *, name: str, description: str, price: float, external_id: str, image_paths: list[Path] | None = None):
    """
    POST /products/edit — обновляет существующий товар по external_id (артикул).

    Все параметры (name, description, price, external_id) и файлы изображений
    должны быть получены из portal_export (см. load_products_from_portal в upload_to_satu).
    Возвращает (success: bool, response).
    """
    body = {"name": name, "description": description, "price": price, "external_id": external_id}
    try:
        if image_paths:
            files = []
            for idx, img_path in enumerate(image_paths):
                if not img_path.exists():
                    continue
                mime = "image/jpeg" if img_path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
                files.append((f"images[{idx}]", (img_path.name, img_path.read_bytes(), mime)))
            form = {k: (v if isinstance(v, str) else str(v)) for k, v in body.items()}
            resp = request("POST", "products/edit", token, data=form, files=files)
        else:
            resp = request("POST", "products/edit", token, json_data=body)
        return resp.status_code in (200, 201), resp
    except Exception as e:
        logger.warning("Ошибка запроса products/edit для %s: %s", external_id, e)
        return False, None


def products_list(token: str, limit: int | None = None):
    """GET /products/list — список товаров компании."""
    path = "products/list"
    if limit is not None:
        path = f"products/list?limit={limit}"
    return request("GET", path, token, json_data=None)


def import_file(token: str, xlsx_path: Path, timeout: int = 120):
    """POST /products/import_file — импорт товаров из XLSX. Файл должен быть сформирован из данных portal_export."""
    base_url, _ = _get_config()
    url = f"{base_url.rstrip('/')}/products/import_file"
    headers = {"Authorization": f"Bearer {token}"}
    import requests
    with open(xlsx_path, "rb") as f:
        files = {"file": (xlsx_path.name, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = requests.post(url, headers=headers, files=files, timeout=timeout)
    return resp


def orders_list(token: str):
    """GET /orders/list — список заказов (см. https://public-api.docs.satu.kz/#/Orders)."""
    return request("GET", "orders/list", token, json_data=None)


def orders_set_status(token: str, status: str, ids: list, cancellation_reason: str | None = None, cancellation_text: str | None = None):
    """
    POST /orders/set_status — смена статуса заказов.
    Документация: https://public-api.docs.satu.kz/#/Orders/postOrdersStatus
    """
    body = {"status": status, "ids": ids}
    if cancellation_reason is not None:
        body["cancellation_reason"] = cancellation_reason
    if cancellation_text is not None:
        body["cancellation_text"] = cancellation_text
    return request("POST", "orders/set_status", token, json_data=body)
