# web/main.py — единый веб: лендинг для пользователей, админка только для администратора
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from web.auth import is_admin_session
from web.routes import (
    login_router, dashboard_router, users_router, tenders_router,
    applications_router, reviews_router, support_router, updates_router,
)
from web.routes.moderation import router as moderation_router
from web.routes.applications_manage import router as applications_manage_router
from web.routes.health import router as health_router
from web.miniapp.routes import router as miniapp_router
from web.templates_loader import templates
from web.utils.csrf import CSRFMiddleware, generate_csrf_token

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app = FastAPI(title="TenderBot")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CSRF protection middleware
app.add_middleware(CSRFMiddleware)

app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

# React Mini App assets (built by tenderbot/miniapp_react/)
_miniapp_assets = Path(__file__).parent / "static" / "miniapp" / "dist" / "assets"
if _miniapp_assets.exists():
    app.mount("/miniapp/assets", StaticFiles(directory=_miniapp_assets), name="miniapp-assets")

app.include_router(health_router, tags=["health"])
app.include_router(login_router, tags=["auth"])
app.include_router(dashboard_router, tags=["dashboard"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(tenders_router, prefix="/tenders", tags=["tenders"])
app.include_router(applications_router, prefix="/applications", tags=["applications"])
app.include_router(support_router, prefix="/support", tags=["support"])
app.include_router(reviews_router, prefix="/reviews", tags=["reviews"])
app.include_router(updates_router, tags=["updates"])
app.include_router(moderation_router, tags=["moderation"])
app.include_router(applications_manage_router, tags=["applications_manage"])
app.include_router(miniapp_router)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


@app.get("/")
async def index(request: Request):
    """Единая точка входа: админ → дашборд, остальные → лендинг (для пользователей + ссылка на админку)."""
    if is_admin_session(request):
        return RedirectResponse(url="/dashboard", status_code=302)
    bot_url = f"https://t.me/{settings.BOT_USERNAME}" if settings.BOT_USERNAME else ""
    return templates.TemplateResponse(
        "landing.html",
        {"request": request, "bot_url": bot_url},
    )
