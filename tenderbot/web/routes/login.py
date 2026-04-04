# web/routes/login.py
import secrets
import time
import logging

from fastapi import APIRouter, Request, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from config import settings
from web.auth import set_session, clear_session, is_admin_session
from web.templates_loader import templates

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Rate limiting for login ---
_login_attempts: dict[str, list[float]] = {}  # ip -> list of timestamps
_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 300  # 5 minutes


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    # Remove old attempts outside the window
    attempts = [t for t in attempts if now - t < _WINDOW_SECONDS]
    _login_attempts[ip] = attempts
    return len(attempts) >= _MAX_ATTEMPTS


def _record_attempt(ip: str) -> None:
    now = time.time()
    attempts = _login_attempts.setdefault(ip, [])
    attempts.append(now)
    # Cleanup: keep only recent entries
    _login_attempts[ip] = [t for t in attempts if now - t < _WINDOW_SECONDS]


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if is_admin_session(request):
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse(request=request, name="login.html", context={})


@router.post("/login")
async def login_post(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting check
    if _is_rate_limited(client_ip):
        logger.warning(f"Login rate limit exceeded for IP {client_ip}")
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={"error": "Слишком много попыток входа. Попробуйте через 5 минут."},
        )

    # Timing-safe comparison to prevent timing attacks
    username_ok = secrets.compare_digest(username.strip(), settings.ADMIN_USERNAME)
    password_ok = secrets.compare_digest(password, settings.ADMIN_PASSWORD)

    if username_ok and password_ok:
        response = RedirectResponse(url="/dashboard", status_code=302)
        set_session(response, settings.ADMIN_USERNAME)
        logger.info(f"Admin login successful from IP {client_ip}")
        return response

    _record_attempt(client_ip)
    logger.warning(f"Failed login attempt from IP {client_ip}")
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"error": "Неверный логин или пароль"},
    )


@router.get("/logout")
async def logout(request: Request):
    response = RedirectResponse(url="/login", status_code=302)
    clear_session(response)
    return response
