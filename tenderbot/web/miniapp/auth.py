# web/miniapp/auth.py — проверка initData от Telegram Web App
"""
Верификация initData от Telegram Mini App:
- Подпись (hash), auth_date с ограничением возраста (MAX_AGE).
- Защита от replay: каждый успешно проверенный initData запоминается на 1 ч;
  повторное использование того же initData отклоняется.

Для Mini App заголовок X-Telegram-Init-Data выступает и как носитель авторизации,
и как CSRF-токен: запрос без валидного initData не принимается (см. BUG-03).
"""
import hmac
import hashlib
import json
import time
from urllib.parse import parse_qsl
from typing import Optional

from config import settings

# Максимальный возраст initData для API (1 час) — защита от долгоживущих перехваченных токенов
INIT_DATA_MAX_AGE_SEC = 3600
# TTL кэша «уже использованных» initData (replay protection)
REPLAY_CACHE_TTL_SEC = 3600

# In-memory кэш использованных initData: key = sha256(init_data), value = expiry timestamp
_replay_cache: dict[str, float] = {}
_REPLAY_MAX_ENTRIES = 50_000


def _replay_key(init_data: str) -> str:
    return hashlib.sha256(init_data.encode("utf-8")).hexdigest()


def _replay_seen(init_data: str) -> bool:
    now = time.time()
    key = _replay_key(init_data)
    if key not in _replay_cache:
        return False
    if _replay_cache[key] < now:
        del _replay_cache[key]
        return False
    return True


def _replay_record(init_data: str) -> None:
    now = time.time()
    if len(_replay_cache) >= _REPLAY_MAX_ENTRIES:
        # Удаляем устаревшие
        expired = [k for k, v in _replay_cache.items() if v < now]
        for k in expired:
            del _replay_cache[k]
    _replay_cache[_replay_key(init_data)] = now + REPLAY_CACHE_TTL_SEC


def _validate_hash(data_check: str, received_hash: str) -> bool:
    secret_key = hmac.new(
        b"WebAppData",
        settings.BOT_TOKEN.encode(),
        hashlib.sha256,
    ).digest()
    calculated = hmac.new(
        secret_key,
        data_check.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(calculated, received_hash)


def validate_init_data(init_data: str, max_age_sec: Optional[int] = 7 * 86400) -> Optional[dict]:
    """
    Проверяет подпись initData от Telegram Web App.
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    max_age_sec: 7 дней по умолчанию (часы на мобильных могут расходиться).
    """
    if not init_data or not settings.BOT_TOKEN:
        return None
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        sorted_pairs = sorted(parsed.items(), key=lambda x: x[0])
        data_check_decoded = "\n".join(f"{k}={v}" for k, v in sorted_pairs)
        data_check_plus = "\n".join(f"{k}={v.replace(' ', '+')}" for k, v in sorted_pairs)
        raw_pairs = []
        for part in init_data.split("&"):
            if "=" not in part:
                continue
            key, _, value = part.partition("=")
            if key != "hash":
                raw_pairs.append((key, value))
        data_check_raw = "\n".join(f"{k}={v}" for k, v in sorted(raw_pairs, key=lambda x: x[0]))
        ok = (
            _validate_hash(data_check_decoded, received_hash)
            or _validate_hash(data_check_plus, received_hash)
            or _validate_hash(data_check_raw, received_hash)
        )
        if not ok:
            return None
        if max_age_sec is not None:
            auth_date = parsed.get("auth_date")
            if auth_date:
                try:
                    ts = int(auth_date)
                    if abs(time.time() - ts) > max_age_sec:
                        return None
                except (ValueError, TypeError):
                    return None
        if "user" in parsed:
            try:
                parsed["user"] = json.loads(parsed["user"])
            except (json.JSONDecodeError, TypeError):
                pass
        return parsed
    except Exception:
        return None


def get_tg_id_from_init_data(init_data: str) -> Optional[int]:
    """
    Из валидного initData извлекает Telegram ID пользователя.
    Для API используется строгий max_age (INIT_DATA_MAX_AGE_SEC) и защита от replay.
    """
    if _replay_seen(init_data):
        return None
    data = validate_init_data(init_data, max_age_sec=INIT_DATA_MAX_AGE_SEC)
    if not data:
        return None
    _replay_record(init_data)
    user = data.get("user")
    if isinstance(user, dict) and "id" in user:
        return int(user["id"])
    return None
