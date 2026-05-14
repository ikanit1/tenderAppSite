"""Персистентное хранилище сессий админа.

Сессии хранятся в data/admin_sessions.json, поэтому рестарт контейнера
не выкидывает админа из панели. Просроченные сессии (> SESSION_TTL)
вычищаются при загрузке.
"""
import json
import logging
import threading
import time
from pathlib import Path
from typing import Dict

logger = logging.getLogger(__name__)

SESSIONS_FILE = Path(__file__).parent / "data" / "admin_sessions.json"
SESSIONS_FILE.parent.mkdir(exist_ok=True)

SESSION_TTL = 24 * 60 * 60  # 24 часа — совпадает с max_age cookie

_lock = threading.Lock()


def _load_raw() -> Dict[str, float]:
    try:
        if SESSIONS_FILE.exists():
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return {str(k): float(v) for k, v in data.items()}
    except Exception as e:
        logger.warning(f"Не удалось загрузить сессии админа: {e}")
    return {}


def _save_raw(data: Dict[str, float]) -> None:
    try:
        SESSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        logger.error(f"Ошибка сохранения сессий админа: {e}")


def _prune(data: Dict[str, float]) -> Dict[str, float]:
    now = time.time()
    return {sid: ts for sid, ts in data.items() if now - ts < SESSION_TTL}


def add_session(session_id: str) -> None:
    """Сохраняет новую сессию с текущей меткой времени."""
    with _lock:
        data = _prune(_load_raw())
        data[session_id] = time.time()
        _save_raw(data)


def remove_session(session_id: str) -> None:
    """Удаляет сессию (логаут)."""
    with _lock:
        data = _prune(_load_raw())
        data.pop(session_id, None)
        _save_raw(data)


def is_valid(session_id: str) -> bool:
    """Проверяет, что сессия существует и не просрочена."""
    if not session_id:
        return False
    with _lock:
        data = _load_raw()
        ts = data.get(session_id)
        if ts is None:
            return False
        if time.time() - ts >= SESSION_TTL:
            data.pop(session_id, None)
            _save_raw(data)
            return False
        return True
