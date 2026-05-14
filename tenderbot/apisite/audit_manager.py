"""Аудит-лог действий в админ-панели.

Записывает кто (IP), что и когда изменил: цены, скидки, видимость товаров,
вход в панель. Хранится в data/audit_log.json, ограничен последними
MAX_ENTRIES записями.
"""
import json
import logging
import threading
from pathlib import Path
from typing import List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)

AUDIT_FILE = Path(__file__).parent / "data" / "audit_log.json"
AUDIT_FILE.parent.mkdir(exist_ok=True)

MAX_ENTRIES = 500

_lock = threading.Lock()


def _load() -> List[Dict]:
    try:
        if AUDIT_FILE.exists():
            with open(AUDIT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception as e:
        logger.warning(f"Не удалось загрузить аудит-лог: {e}")
    return []


def _save(entries: List[Dict]) -> None:
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_FILE, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Ошибка сохранения аудит-лога: {e}")


def log(action: str, target: str = "", details: str = "", ip: str = "") -> None:
    """Добавляет запись в аудит-лог.

    action  — тип действия (например, "Скидка по бренду", "Скрыт бренд")
    target  — на что повлияло (модель, бренд)
    details — подробности (новое значение и т.п.)
    ip      — IP инициатора
    """
    entry = {
        "timestamp": datetime.now().isoformat(),
        "ip": ip or "",
        "action": action,
        "target": target,
        "details": details,
    }
    try:
        with _lock:
            entries = _load()
            entries.append(entry)
            if len(entries) > MAX_ENTRIES:
                entries = entries[-MAX_ENTRIES:]
            _save(entries)
    except Exception as e:
        logger.error(f"Не удалось записать в аудит-лог: {e}")


def get_log(limit: int = 100) -> List[Dict]:
    """Возвращает последние записи аудита (новые сверху)."""
    with _lock:
        entries = _load()
    return list(reversed(entries[-limit:]))
