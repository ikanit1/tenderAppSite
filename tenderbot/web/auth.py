# web/auth.py — авторизация администратора (пароль + сессия)
import logging
from typing import Optional

from fastapi import Request, Response, Depends
from fastapi.responses import RedirectResponse
from itsdangerous import URLSafeTimedSerializer, BadSignature

from config import settings

logger = logging.getLogger(__name__)

SECRET = settings.WEB_SECRET_KEY
serializer = URLSafeTimedSerializer(SECRET, salt="web-admin-session")


def get_session_user(request: Request) -> Optional[str]:
    """Возвращает логин из cookie или None."""
    token = request.cookies.get("session")
    if not token:
        return None
    try:
        data = serializer.loads(token, max_age=86400 * 7)  # 7 дней
        return data.get("user")
    except BadSignature:
        return None


def is_admin_session(request: Request) -> bool:
    """True, если в сессии залогинен единственный администратор."""
    user = get_session_user(request)
    return user == settings.ADMIN_USERNAME


def set_session(response: Response, user: str) -> None:
    response.set_cookie(
        "session",
        serializer.dumps({"user": user}),
        max_age=86400 * 7,
        httponly=True,
        samesite="lax",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie("session")


def require_admin(request: Request) -> Optional[RedirectResponse]:
    """
    Доступ только для администратора.
    Нет сессии → /login; сессия не админ → / (лендинг).
    Используется как: if redir := require_admin(request): return redir
    """
    user = get_session_user(request)
    if user is None:
        return RedirectResponse(url="/login", status_code=302)
    if user != settings.ADMIN_USERNAME:
        return RedirectResponse(url="/", status_code=302)
    return None


def check_tender_ownership(request: Request, tender, db) -> bool:
    """Проверка, что пользователь может редактировать тендер (админ или создатель)."""
    user = get_session_user(request)
    if not user:
        return False
    return True


def check_user_edit_permission(request: Request, user_id: int, db) -> bool:
    """Проверка, что пользователь может редактировать пользователя (только админ)."""
    user = get_session_user(request)
    if not user:
        return False
    return True
