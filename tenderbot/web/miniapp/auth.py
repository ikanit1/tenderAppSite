# web/miniapp/auth.py — проверка initData от Telegram Web App
import hmac
import hashlib
import json
import time
from urllib.parse import parse_qsl
from typing import Optional

from config import settings


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
    """Из валидного initData извлекает Telegram ID пользователя."""
    data = validate_init_data(init_data)
    if not data:
        return None
    user = data.get("user")
    if isinstance(user, dict) and "id" in user:
        return int(user["id"])
    return None
