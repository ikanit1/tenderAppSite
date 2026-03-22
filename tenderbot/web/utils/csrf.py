# web/utils/csrf.py — CSRF protection for web forms
import logging

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from config import settings

logger = logging.getLogger(__name__)

CSRF_TOKEN_NAME = "csrf_token"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_FIELD_NAME = "csrf_token"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Paths exempt from CSRF (API endpoints that use other auth)
_EXEMPT_PREFIXES = ("/miniapp/", "/health", "/updates", "/support/api/")


def generate_csrf_token(request: Request) -> str:
    """Generate or retrieve CSRF token from session cookie."""
    from web.auth import get_session_user
    from itsdangerous import URLSafeTimedSerializer

    serializer = URLSafeTimedSerializer(settings.WEB_SECRET_KEY, salt="csrf-token")
    user = get_session_user(request) or "anonymous"
    return serializer.dumps({"user": user})


def validate_csrf_token(request: Request, token: str) -> bool:
    """Validate a CSRF token."""
    from web.auth import get_session_user
    from itsdangerous import URLSafeTimedSerializer, BadSignature

    serializer = URLSafeTimedSerializer(settings.WEB_SECRET_KEY, salt="csrf-token")
    try:
        data = serializer.loads(token, max_age=86400)  # 24h validity
        user = get_session_user(request) or "anonymous"
        return data.get("user") == user
    except (BadSignature, Exception):
        return False


class CSRFMiddleware(BaseHTTPMiddleware):
    """Middleware that validates CSRF tokens on non-safe HTTP methods.

    Extracts the token from the raw body bytes (url-encoded) or header
    WITHOUT calling request.form(), so FastAPI Form() params still work.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method in _SAFE_METHODS:
            return await call_next(request)

        # Skip CSRF for exempt paths
        path = request.url.path
        for prefix in _EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Skip CSRF for login
        if path == "/login":
            return await call_next(request)

        # --- Extract CSRF token without consuming request.form() ---
        token = request.headers.get(CSRF_HEADER_NAME)

        if not token:
            content_type = request.headers.get("content-type", "")

            if "application/x-www-form-urlencoded" in content_type:
                # Parse token from raw body bytes — doesn't consume the stream
                # for BaseHTTPMiddleware (body is cached after first read).
                try:
                    from urllib.parse import parse_qs
                    body = await request.body()
                    parsed = parse_qs(body.decode("utf-8", errors="replace"))
                    values = parsed.get(CSRF_FIELD_NAME, [])
                    token = values[0] if values else None
                except Exception:
                    pass

            elif "multipart/form-data" in content_type:
                # For multipart: read raw body, find the csrf_token field
                try:
                    body = await request.body()
                    body_str = body.decode("utf-8", errors="replace")
                    # Simple search for csrf_token value in multipart body
                    import re
                    match = re.search(
                        r'name="csrf_token"\r?\n\r?\n([^\r\n-]+)',
                        body_str,
                    )
                    if match:
                        token = match.group(1).strip()
                except Exception:
                    pass

        if not token or not validate_csrf_token(request, token):
            logger.warning(f"CSRF validation failed for {request.method} {path}")
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid")

        return await call_next(request)
