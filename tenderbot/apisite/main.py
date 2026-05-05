"""Основной API сервер"""
from fastapi import FastAPI, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, Response as HttpResponse
from typing import Optional, Literal
import base64
from contextlib import asynccontextmanager
from pathlib import Path
from pydantic import BaseModel, Field
from b2b_client import B2BClient
from models import ProductsResponse, Product, HealthResponse
from utils import model_to_foldername, get_clean_id, normalize_model_for_fs
from config import (
    UPDATE_INTERVAL_MINUTES, IMAGE_PARSER_ENABLED, IMAGE_PARSER_MAX_PAGES, IMAGE_PARSER_STARTUP_DELAY,
    OPENAI_API_KEY, OPENAI_MODEL, OPENROUTER_API_KEY, OPENROUTER_MODEL,
    CORS_ORIGINS,
    ADMIN_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_USE_TLS, SMTP_USE_SSL,
    ADMIN_LOGIN, ADMIN_PASSWORD,
    SITEMAP_BASE_URL,
)
import io
import json
import time
import logging
import asyncio
import requests
import shutil
import subprocess
import threading
import re
import uuid
import secrets
from functools import lru_cache

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# #region agent log
DEBUG_LOG_PATH = Path(__file__).resolve().parent.parent.parent / ".cursor" / "debug.log"
def _debug_log(location: str, message: str, data: dict, hypothesis_id: str):
    try:
        import json as _json
        payload = {"id": f"log_{int(time.time())}_{hypothesis_id}", "timestamp": int(time.time() * 1000), "location": location, "message": message, "data": data, "hypothesisId": hypothesis_id}
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(_json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass
# #endregion

# React build state
_react_build_lock = threading.Lock()
_react_build_error: Optional[str] = None

# Портал: категории и картинки из portal_export/items.json
PORTAL_ITEMS_JSON = Path(__file__).parent / "portal_export" / "items.json"
PORTAL_EXPORT_DIR = Path(__file__).parent / "portal_export"

# Папка Akuvox в корне проекта (public/akuvox) — для checkout и каталога
_PUBLIC_AKUVOX_DIR = Path(__file__).resolve().parent.parent.parent / "public" / "akuvox"

# Кэш: clean_id → имя папки в portal_export (для сопоставления без учёта /, -, _ и т.д.)
_clean_id_to_portal_folder: dict = {}


def _build_clean_id_portal_index() -> None:
    """Строит индекс clean_id → folder_name по содержимому portal_export."""
    global _clean_id_to_portal_folder
    _clean_id_to_portal_folder = {}
    if not PORTAL_EXPORT_DIR.exists():
        return
    for child in PORTAL_EXPORT_DIR.iterdir():
        if child.is_dir():
            cid = get_clean_id(child.name)
            if cid and cid not in _clean_id_to_portal_folder:
                _clean_id_to_portal_folder[cid] = child.name


def _folder_candidates_for_model(model: str):
    """
    Варианты имени папки для поиска в portal_export.
    На сайте модель может быть с «/» (напр. DHI-NVR1104HS-S3/H), в Windows папка — с «_» или «-»
    (DHI-NVR1104HS-S3_H). Поэтому ищем всегда: имя с заменой / → _ и имя с заменой / → -.
    """
    if not model or not isinstance(model, str):
        return []
    model = model.strip()
    norm = normalize_model_for_fs(model)
    # Где в названии идёт «/» — ищем папку с «_» или «-» вместо «/»
    candidates = [
        norm.replace("/", "_"),
        norm.replace("/", "-"),
        model_to_foldername(model),
    ]
    seen = set()
    out = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _portal_folder_for_model(model: str):
    """
    Возвращает Path папки в portal_export для модели или None.
    Модель с «/» (напр. DHI-NVR1104HS-S3/H) считывается: ищется папка с «_» или «-» вместо «/».
    """
    if not model or not isinstance(model, str):
        return None
    model = model.strip()
    # 1) Оба формата: _ и -
    for folder_name in _folder_candidates_for_model(model):
        portal_dir = PORTAL_EXPORT_DIR / folder_name
        if portal_dir.exists() and portal_dir.is_dir():
            return portal_dir
    # 2) «Слепое» сопоставление по clean_id
    if not _clean_id_to_portal_folder:
        _build_clean_id_portal_index()
    cid = get_clean_id(normalize_model_for_fs(model))
    folder_name = _clean_id_to_portal_folder.get(cid) if cid else None
    if folder_name:
        portal_dir = PORTAL_EXPORT_DIR / folder_name
        if portal_dir.exists() and portal_dir.is_dir():
            return portal_dir
    return None


def _find_product_by_model(products: list, model: str) -> Optional[dict]:
    """
    Поиск товара по модели: точное совпадение или по clean_id
    (URL с _ или - вместо / в модели всё равно находит товар с /).
    """
    if not model or not products:
        return None
    model = model.strip()
    for p in products:
        m = (p.get("model") or "").strip()
        if not m:
            continue
        if m.lower() == model.lower():
            return p
    cid = get_clean_id(normalize_model_for_fs(model))
    if not cid:
        return None
    for p in products:
        m = (p.get("model") or "").strip()
        if m and get_clean_id(normalize_model_for_fs(m)) == cid:
            return p
    return None


def _load_portal_items_map() -> dict:
    """Загружает items.json, возвращает dict: model -> item (category, image[])."""
    if not PORTAL_ITEMS_JSON.exists():
        return {}
    try:
        data = json.loads(PORTAL_ITEMS_JSON.read_text(encoding="utf-8"))
        items = data.get("items", [])
        by_model = {}
        by_name = {}
        for it in items:
            model = (it.get("model") or "").strip()
            name = (it.get("name") or "").strip()
            if model:
                by_model[model.upper()] = it
            if name:
                by_name[name.lower()] = it
        return {"by_model": by_model, "by_name": by_name}
    except Exception as e:
        logger.debug("Не удалось загрузить portal items.json: %s", e)
        return {}


# Глобальное состояние
cache_state = {
    "data": None,
    "last_update": 0,
    "lock": None
}

# Состояние парсера изображений
image_parser_state = {
    "running": False,
    "last_run": None,
    "task": None
}

# Хранилище корзин по session ID (in-memory)
_cart_storage: dict[str, list] = {}
_cart_storage_lock = threading.Lock()

# Хранилище сессий админа: session_id -> True (если авторизован)
_admin_sessions: set[str] = set()
_admin_sessions_lock = threading.Lock()

# Защита от брутфорса входа в админку: IP -> (количество неудачных попыток, время разблокировки)
_admin_login_attempts: dict[str, tuple[int, float]] = {}
_admin_login_attempts_lock = threading.Lock()
ADMIN_LOGIN_MAX_ATTEMPTS = 5
ADMIN_LOGIN_LOCKOUT_SECONDS = 15 * 60  # 15 минут


def _get_client_ip(request: Request) -> str:
    """IP клиента с учётом X-Forwarded-For (за nginx/proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "127.0.0.1"
    return "127.0.0.1"


def _check_admin_bruteforce(request: Request) -> None:
    """Проверяет, не заблокирован ли IP из-за брутфорса. Выбрасывает HTTP 429 при блокировке."""
    ip = _get_client_ip(request)
    now = time.time()
    with _admin_login_attempts_lock:
        data = _admin_login_attempts.get(ip)
        if not data:
            return
        count, lock_until = data
        if now < lock_until and count >= ADMIN_LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Слишком много неудачных попыток входа. Попробуйте через {int((lock_until - now) / 60) + 1} мин.",
            )
        if now >= lock_until:
            _admin_login_attempts.pop(ip, None)


def _record_admin_login_fail(request: Request) -> None:
    """Увеличивает счётчик неудачных попыток и при необходимости блокирует IP."""
    ip = _get_client_ip(request)
    now = time.time()
    with _admin_login_attempts_lock:
        count, lock_until = _admin_login_attempts.get(ip, (0, 0.0))
        if now >= lock_until:
            count = 0
        count += 1
        if count >= ADMIN_LOGIN_MAX_ATTEMPTS:
            lock_until = now + ADMIN_LOGIN_LOCKOUT_SECONDS
        else:
            lock_until = max(lock_until, now + 60)  # сброс счётчика через 1 мин без попыток
        _admin_login_attempts[ip] = (count, lock_until)


def _clear_admin_login_fail(request: Request) -> None:
    """Сбрасывает счётчик неудачных попыток после успешного входа."""
    ip = _get_client_ip(request)
    with _admin_login_attempts_lock:
        _admin_login_attempts.pop(ip, None)


# Инициализируем lock при первом использовании
def get_lock():
    """Получает или создает lock для кэша"""
    if cache_state["lock"] is None:
        cache_state["lock"] = asyncio.Lock()
    return cache_state["lock"]


def get_or_create_session_id(request: Request, response: Response) -> str:
    """Получает session ID из cookie или создает новый"""
    session_id = request.cookies.get("cart_session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        # Behind Nginx we rely on X-Forwarded-Proto to decide whether HTTPS is used.
        forwarded_proto = (request.headers.get("x-forwarded-proto") or "").lower()
        is_https = forwarded_proto == "https" or (getattr(request.url, "scheme", "") == "https")
        response.set_cookie(
            key="cart_session_id",
            value=session_id,
            max_age=30 * 24 * 60 * 60,  # 30 дней
            httponly=False,  # Нужен доступ из JavaScript
            # Path "/" is important: otherwise cookie path may be tied to /catalog/api/ or /api/
            # and the cart would "disappear" when requests hit another prefix.
            path="/",
            # SameSite=None requires Secure. For localhost HTTP we fallback to Lax.
            samesite="none" if is_https else "lax",
            secure=True if is_https else False,
        )
    return session_id


def require_admin_auth(request: Request) -> None:
    """Проверяет авторизацию админа, выбрасывает HTTPException если не авторизован"""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")


def get_admin_session_id(request: Request) -> Optional[str]:
    """Получает session ID админа из cookie"""
    return request.cookies.get("admin_session_id")


def is_admin_authenticated(request: Request) -> bool:
    """Проверяет, авторизован ли админ"""
    session_id = get_admin_session_id(request)
    if not session_id:
        return False
    with _admin_sessions_lock:
        return session_id in _admin_sessions


def create_admin_session(response: Response, request: Request) -> str:
    """Создает новую сессию админа"""
    session_id = str(uuid.uuid4())
    with _admin_sessions_lock:
        _admin_sessions.add(session_id)
    
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").lower()
    is_https = forwarded_proto == "https" or (getattr(request.url, "scheme", "") == "https")
    
    response.set_cookie(
        key="admin_session_id",
        value=session_id,
        max_age=24 * 60 * 60,  # 24 часа
        httponly=False,
        path="/",
        samesite="none" if is_https else "lax",
        secure=True if is_https else False,
    )
    return session_id


def remove_admin_session(request: Request, response: Response) -> None:
    """Удаляет сессию админа"""
    session_id = get_admin_session_id(request)
    if session_id:
        with _admin_sessions_lock:
            _admin_sessions.discard(session_id)
    
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").lower()
    is_https = forwarded_proto == "https" or (getattr(request.url, "scheme", "") == "https")
    
    response.delete_cookie(
        key="admin_session_id",
        path="/",
        samesite="none" if is_https else "lax",
        secure=True if is_https else False,
    )


@lru_cache()
def get_b2b_client() -> B2BClient:
    """Dependency для получения B2B клиента"""
    return B2BClient()


def should_update() -> bool:
    """Проверяет, нужно ли обновлять данные"""
    current_time = time.time()
    interval_seconds = UPDATE_INTERVAL_MINUTES * 60
    return (current_time - cache_state["last_update"]) >= interval_seconds


async def get_cached_data(client: B2BClient = Depends(get_b2b_client)) -> dict:
    """Получает кэшированные данные, обновляя при необходимости"""
    lock = get_lock()
    async with lock:
        if should_update() or cache_state["data"] is None:
            try:
                # Запускаем синхронный запрос в executor
                loop = asyncio.get_running_loop()
                data = await loop.run_in_executor(None, client.update_products)
                cache_state["data"] = data
                cache_state["last_update"] = time.time()
                logger.info(f"Данные обновлены: {data.get('updated')}")
                    
            except Exception as e:
                logger.error(f"Ошибка обновления данных: {e}")
                if cache_state["data"] is None:
                    raise HTTPException(status_code=503, detail="Сервис временно недоступен")
        
        return cache_state["data"]


async def run_image_parser_background():
    """Запускает парсер изображений в фоновом режиме"""
    if not IMAGE_PARSER_ENABLED:
        logger.info("Парсер изображений отключен (IMAGE_PARSER_ENABLED=false)")
        return
    
    try:
        # Ждем указанное время перед запуском (чтобы API успел запуститься)
        await asyncio.sleep(IMAGE_PARSER_STARTUP_DELAY)
        
        logger.info(f"Запуск парсера изображений в фоновом режиме (max_pages={IMAGE_PARSER_MAX_PAGES if IMAGE_PARSER_MAX_PAGES > 0 else 'все'})")
        image_parser_state["running"] = True
        
        from product_image_parser import parse_catalog, download_images_for_products, load_parser_cache
        
        # Загружаем кэш обработанных товаров и изображений
        load_parser_cache()
        
        # Определяем количество страниц
        max_pages = None if IMAGE_PARSER_MAX_PAGES == 0 else IMAGE_PARSER_MAX_PAGES
        
        # Парсим каталог
        loop = asyncio.get_running_loop()
        products_images = await loop.run_in_executor(
            None,
            parse_catalog,
            max_pages
        )
        
        if not products_images:
            logger.warning("Парсер изображений: не найдено товаров с изображениями")
            image_parser_state["running"] = False
            return
        
        logger.info(f"Парсер изображений: найдено {len(products_images)} товаров с изображениями")
        
        # Скачиваем изображения сразу после парсинга всех страниц
        # Изображения сохраняются в images/{model}/ и сразу доступны через API
        downloaded = await loop.run_in_executor(
            None,
            lambda: download_images_for_products(products_images, download_immediately=True)
        )
        
        total_downloaded = sum(downloaded.values())
        image_parser_state["last_run"] = time.time()
        image_parser_state["running"] = False
        
        logger.info(f"✅ Парсер изображений завершен: скачано {total_downloaded} изображений для {len(downloaded)} товаров")
        logger.info(f"📁 Изображения сохранены в: {Path(__file__).parent / 'images'}")
        logger.info(f"🌐 Изображения доступны через API: /api/products/{{model}}/image")
        
    except Exception as e:
        logger.error(f"Ошибка при работе парсера изображений: {e}", exc_info=True)
        image_parser_state["running"] = False


# Фоновые задачи парсера портала (чтобы не терять ссылку)
_portal_parser_tasks: set = set()
_portal_parser_started_at: Optional[float] = None  # time.time() при старте
_portal_parser_log_buffer: list = []  # последние сообщения (max 500)
_PORTAL_PARSER_LOG_MAX = 500


class _PortalParserLogHandler(logging.Handler):
    """Пишет логи парсера в буфер для просмотра в админке."""
    def emit(self, record):
        try:
            msg = self.format(record)
            _portal_parser_log_buffer.append(msg)
            while len(_portal_parser_log_buffer) > _PORTAL_PARSER_LOG_MAX:
                _portal_parser_log_buffer.pop(0)
        except Exception:
            pass


def _run_portal_parser_subprocess(start_page: int, end_page: int) -> bool:
    """Запуск portal_parser_cannon.py через subprocess (fallback)."""
    import subprocess
    import sys
    base = Path(__file__).resolve().parent
    parser_script = base / "portal_parser_cannon.py"
    if not parser_script.exists():
        logger.error(f"Файл {parser_script} не найден")
        return False
    process = subprocess.Popen(
        [sys.executable, str(parser_script), "--start", str(start_page), "--end", str(end_page)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(base),
    )
    logger.info(f"Парсер запущен через subprocess (PID: {process.pid})")
    return True


def _portal_parser_done_callback(task):
    global _portal_parser_started_at
    _portal_parser_tasks.discard(task)
    if not _portal_parser_tasks:
        _portal_parser_started_at = None
        cannon_logger = logging.getLogger("portal_parser_cannon")
        for h in cannon_logger.handlers[:]:
            if isinstance(h, _PortalParserLogHandler):
                cannon_logger.removeHandler(h)
                break


async def run_portal_parser_cannon(
    start_page: int = 1,
    end_page: int = 0,  # 0 = авто-определение из пагинации сайта
    only_expected_folders: Optional[set] = None,
):
    """
    Запускает парсер портала (portal_parser_cannon).
    Если задан only_expected_folders, парсер обрабатывает только товары с этими именами папок (режим «недостающие»).
    Если end_page=0, автоматически определяет последнюю страницу из пагинации сайта.
    """
    global _portal_parser_started_at
    try:
        from portal_parser_cannon import run_cannon
        _portal_parser_started_at = time.time()
        cannon_logger = logging.getLogger("portal_parser_cannon")
        handler = _PortalParserLogHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        cannon_logger.addHandler(handler)
        task = asyncio.create_task(run_cannon(start_page, end_page, only_expected_folders))
        _portal_parser_tasks.add(task)
        task.add_done_callback(_portal_parser_done_callback)
        mode = f"только недостающие ({len(only_expected_folders)} шт.)" if only_expected_folders else f"страницы {start_page}-{end_page}"
        logger.info(f"Запуск portal_parser_cannon в процессе: {mode}")
        return True
    except ImportError as e:
        if only_expected_folders:
            logger.error("Режим «недостающие» требует запуска в процессе: %s", e)
            return False
        logger.warning(f"Импорт portal_parser_cannon не удался: {e}, запуск через subprocess")
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _run_portal_parser_subprocess, start_page, end_page)
    except Exception as e:
        logger.error(f"Ошибка запуска portal_parser_cannon: {e}")
        return False


# Глобальная переменная для отслеживания последнего запуска парсера
_portal_parser_last_run_date = None

async def schedule_nightly_parser():
    """Планировщик автозапуска парсера каждую ночь 00:00-02:00"""
    import datetime
    global _portal_parser_last_run_date
    
    while True:
        try:
            now = datetime.datetime.now()
            today = now.date()
            
            # Проверяем, находимся ли мы в окне 00:00-02:00
            if now.hour >= 0 and now.hour < 2:
                # Запускаем парсер только если он еще не запущен сегодня
                if _portal_parser_last_run_date != today:
                    logger.info(f"Автозапуск portal_parser_cannon (ночной режим, {now.strftime('%Y-%m-%d %H:%M')})")
                    await run_portal_parser_cannon(1, 0)  # 0 = авто-определение страниц
                    _portal_parser_last_run_date = today
            else:
                # Если вышли из окна 00:00-02:00, сбрасываем флаг для следующей ночи
                if _portal_parser_last_run_date == today and now.hour >= 2:
                    _portal_parser_last_run_date = None
            
            # Ждём 30 минут перед следующей проверкой (более точное отслеживание времени)
            await asyncio.sleep(1800)
        except asyncio.CancelledError:
            logger.info("Планировщик автозапуска парсера остановлен")
            break
        except Exception as e:
            logger.error(f"Ошибка в планировщике автозапуска: {e}")
            await asyncio.sleep(1800)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events для приложения"""
    # Пытаемся собрать React frontend автоматически, если build отсутствует.
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _ensure_react_build_sync)
    except Exception as e:
        logger.error("Ошибка автосборки React frontend: %s", e)

    # Startup
    client = get_b2b_client()
    try:
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(None, client.update_products)
        cache_state["data"] = data
        cache_state["last_update"] = time.time()
        logger.info("Приложение запущено, данные загружены")
            
    except Exception as e:
        logger.error(f"Ошибка при загрузке данных при старте: {e}")

    # Запускаем планировщик автозапуска парсера
    parser_scheduler_task = asyncio.create_task(schedule_nightly_parser())
    
    yield
    
    # Shutdown
    # Останавливаем планировщик парсера
    parser_scheduler_task.cancel()
    try:
        await parser_scheduler_task
    except asyncio.CancelledError:
        pass
    
    # Отменяем задачу парсера если она еще выполняется
    if image_parser_state.get("task") and not image_parser_state["task"].done():
        logger.info("Остановка парсера изображений...")
        image_parser_state["task"].cancel()
        try:
            await image_parser_state["task"]
        except asyncio.CancelledError:
            pass
    
    logger.info("Приложение остановлено")


app = FastAPI(
    title="B2B Products API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
# CORS_ORIGINS может быть "*" или конкретный домен (например, "https://grgroup.kz")
# Если указано несколько доменов через запятую, они будут разделены
cors_origins_list = ["*"] if CORS_ORIGINS == "*" else [origin.strip() for origin in CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# React build (SPA)
react_dist_dir = Path(__file__).parent / "react" / "dist"
react_index_file = react_dist_dir / "index.html"
react_root_dir = Path(__file__).parent / "react"


def _run_cmd(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
        timeout=900,
    )
    output = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
    if result.returncode != 0:
        raise RuntimeError(f"Команда {' '.join(cmd)} завершилась с кодом {result.returncode}.\n{output}")
    return output


def _ensure_react_build_sync() -> bool:
    """
    Гарантирует наличие react/dist/index.html.
    Если сборка отсутствует, пытается выполнить npm install (при необходимости) и npm run build.
    """
    global _react_build_error

    if react_index_file.exists():
        _react_build_error = None
        return True

    with _react_build_lock:
        # Проверяем повторно внутри lock, чтобы не запускать параллельную сборку.
        if react_index_file.exists():
            _react_build_error = None
            return True

        if not react_root_dir.exists():
            _react_build_error = f"Папка frontend не найдена: {react_root_dir}"
            return False

        npm_cmd = shutil.which("npm") or shutil.which("npm.cmd")
        if not npm_cmd:
            _react_build_error = "Команда npm не найдена в PATH"
            return False

        try:
            node_modules_dir = react_root_dir / "node_modules"
            if not node_modules_dir.exists():
                logger.info("React build отсутствует: выполняю npm install...")
                _run_cmd([npm_cmd, "install"], react_root_dir)

            logger.info("Выполняю npm run build для React frontend...")
            _run_cmd([npm_cmd, "run", "build"], react_root_dir)
        except Exception as e:
            _react_build_error = str(e)
            logger.error("Не удалось собрать React frontend: %s", _react_build_error)
            return False

        if react_index_file.exists():
            logger.info("React frontend успешно собран: %s", react_index_file)
            _react_build_error = None
            return True

        _react_build_error = f"Сборка завершилась, но файл не найден: {react_index_file}"
        return False


async def _ensure_react_build_async() -> bool:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _ensure_react_build_sync)


def _react_build_missing_response() -> HTMLResponse:
    details = f"\nError details:\n{_react_build_error}" if _react_build_error else ""
    return HTMLResponse(
        content="""
<html>
  <head><title>React build not found</title></head>
  <body>
    <h1>React build not found</h1>
    <p>Frontend build is missing and auto-build failed. Build it before starting the API:</p>
    <pre>cd e:/tenderbot/apisite/react
npm install
npm run build{details}</pre>
  </body>
</html>
""".strip().format(details=details),
        status_code=503,
    )


def _html_escape(value: str) -> str:
    """Минимальное HTML-экранирование для инъекции в meta-теги."""
    if value is None:
        return ""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _build_product_image_url(product: dict) -> str:
    """Возвращает абсолютный URL первой картинки товара или og-image по умолчанию."""
    base = SITEMAP_BASE_URL.rstrip("/")
    images = product.get("images") or []
    model = (product.get("model") or "").strip()
    if images and model:
        from urllib.parse import quote
        folder = quote(model, safe="")
        first = images[0]
        return f"{base}/catalog/portal_export/{folder}/{first}"
    return f"{base}/og-image.png"


def _truncate(text: str, limit: int = 160) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _build_product_seo_block(product: dict) -> str:
    """
    Генерирует <head>-блок с meta-тегами + JSON-LD Product для конкретного товара.
    Возвращает HTML, который надо вставить ПЕРЕД </head> в index.html.
    """
    base = SITEMAP_BASE_URL.rstrip("/")
    name = (product.get("name") or product.get("model") or "Товар").strip()
    model = (product.get("model") or "").strip()
    brand = (product.get("brand") or "").strip()
    description_raw = (product.get("description") or "").strip()
    if not description_raw:
        # fallback из html-описания
        html_desc = product.get("description_html") or ""
        description_raw = re.sub(r"<[^>]+>", " ", html_desc)
        description_raw = re.sub(r"\s+", " ", description_raw).strip()
    if not description_raw:
        description_raw = f"{name}. {brand}. Купить в Казахстане у G&R Group: оригинал, гарантия, доставка."

    description = _truncate(description_raw, 160)
    title = f"{name} — купить в Казахстане | G&R Group"
    canonical = f"{base}/catalog/?model={model}"
    image_url = _build_product_image_url(product)

    final_price = product.get("final_price") or product.get("price")
    quantity = product.get("quantity")
    in_stock = quantity is None or (isinstance(quantity, (int, float)) and quantity > 0)

    # JSON-LD Product
    schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": name,
        "sku": model,
        "description": description,
        "image": image_url,
        "url": canonical,
    }
    if brand:
        schema["brand"] = {"@type": "Brand", "name": brand}

    # Offer block — только если цена осмысленная
    if final_price and isinstance(final_price, (int, float)) and 0 < final_price < 10**9:
        schema["offers"] = {
            "@type": "Offer",
            "url": canonical,
            "priceCurrency": "KZT",
            "price": str(int(final_price)),
            "availability": "https://schema.org/InStock" if in_stock else "https://schema.org/OutOfStock",
            "seller": {"@type": "Organization", "name": "ТОО «G&R Group»"},
        }

    # Breadcrumbs
    breadcrumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Каталог", "item": f"{base}/catalog/"},
            {"@type": "ListItem", "position": 3, "name": name, "item": canonical},
        ],
    }

    title_e = _html_escape(title)
    desc_e = _html_escape(description)
    canonical_e = _html_escape(canonical)
    image_e = _html_escape(image_url)

    return f"""
    <!-- SEO: динамические meta для товара -->
    <title>{title_e}</title>
    <meta name="description" content="{desc_e}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="{canonical_e}" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="{canonical_e}" />
    <meta property="og:title" content="{title_e}" />
    <meta property="og:description" content="{desc_e}" />
    <meta property="og:image" content="{image_e}" />
    <meta property="og:locale" content="ru_KZ" />
    <meta property="og:site_name" content="ТОО «G&amp;R Group»" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title_e}" />
    <meta name="twitter:description" content="{desc_e}" />
    <meta name="twitter:image" content="{image_e}" />
    <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
    <script type="application/ld+json">{json.dumps(breadcrumbs, ensure_ascii=False)}</script>
    """.strip()


def _build_catalog_index_seo_block() -> str:
    """SEO-блок для самого каталога (когда нет ?model=)."""
    base = SITEMAP_BASE_URL.rstrip("/")
    title = "Каталог оборудования: видеонаблюдение, домофония, СКУД | G&R Group"
    description = (
        "Каталог профессионального оборудования: камеры Dahua, Hikvision, Imou, домофоны Akuvox, "
        "СКУД, кабельная продукция. Прямые поставки в Казахстан, гарантия от производителя."
    )
    canonical = f"{base}/catalog/"
    schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": description,
        "url": canonical,
        "isPartOf": {"@type": "WebSite", "name": "ТОО «G&R Group»", "url": base},
    }
    breadcrumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Каталог", "item": canonical},
        ],
    }
    title_e = _html_escape(title)
    desc_e = _html_escape(description)
    canonical_e = _html_escape(canonical)
    return f"""
    <!-- SEO: каталог (раздел) -->
    <title>{title_e}</title>
    <meta name="description" content="{desc_e}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="{canonical_e}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{canonical_e}" />
    <meta property="og:title" content="{title_e}" />
    <meta property="og:description" content="{desc_e}" />
    <meta property="og:locale" content="ru_KZ" />
    <meta property="og:site_name" content="ТОО «G&amp;R Group»" />
    <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
    <script type="application/ld+json">{json.dumps(breadcrumbs, ensure_ascii=False)}</script>
    """.strip()


async def _serve_catalog_html(model_param: Optional[str], cached_data: dict) -> HTMLResponse:
    """
    Отдаёт index.html SPA с инъекцией SEO-метаданных:
    - если ?model=X — товарные meta + JSON-LD Product
    - иначе — meta каталога + CollectionPage
    """
    if not (react_index_file.exists() or await _ensure_react_build_async()):
        return _react_build_missing_response()

    try:
        html = react_index_file.read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("Не удалось прочитать index.html: %s", exc)
        return FileResponse(react_index_file)

    seo_block = ""
    if model_param:
        products = cached_data.get("products", []) or []
        product = _find_product_by_model(products, model_param)
        if product:
            seo_block = _build_product_seo_block(product)
    if not seo_block:
        seo_block = _build_catalog_index_seo_block()

    # Удаляем существующий <title> из index.html, чтобы наш заголовок не дублировался
    html_modified = re.sub(r"<title>[^<]*</title>", "", html, count=1)
    # Вставляем SEO-блок прямо перед </head>
    if "</head>" in html_modified:
        html_modified = html_modified.replace("</head>", f"{seo_block}\n  </head>", 1)
    else:
        html_modified = seo_block + html_modified

    return HTMLResponse(content=html_modified)


@app.get("/", response_class=HTMLResponse)
async def root(model: Optional[str] = None, cached_data: dict = Depends(get_cached_data)):
    """Главная SPA-страница каталога с SEO-инъекцией."""
    return await _serve_catalog_html(model, cached_data)


@app.get("/catalog", response_class=HTMLResponse)
async def catalog_page(model: Optional[str] = None, cached_data: dict = Depends(get_cached_data)):
    """Альтернативный путь каталога (для basename совместимости)."""
    return await _serve_catalog_html(model, cached_data)


@app.get("/checkout", response_class=HTMLResponse)
async def checkout_page():
    """SPA маршрут оформления заказа"""
    if react_index_file.exists() or await _ensure_react_build_async():
        return FileResponse(react_index_file)
    return _react_build_missing_response()


@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    """SPA маршрут админки (noindex)."""
    if not (react_index_file.exists() or await _ensure_react_build_async()):
        return _react_build_missing_response()
    try:
        html = react_index_file.read_text(encoding="utf-8")
        if "<head>" in html:
            html = html.replace("<head>", '<head><meta name="robots" content="noindex, nofollow" />', 1)
        return HTMLResponse(content=html)
    except Exception:
        return FileResponse(react_index_file)


@app.get("/sitemap.xml")
async def sitemap_xml(cached_data: dict = Depends(get_cached_data)):
    """
    Генерирует sitemap.xml: главная, страницы сайта, каталог, все товары с lastmod и image:image.
    Nginx проксирует grgroup.kz/sitemap.xml сюда.
    """
    from urllib.parse import quote
    from datetime import datetime, timezone

    base = SITEMAP_BASE_URL.rstrip("/")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ]

    # Статические страницы маркетингового сайта
    static_urls = [
        (f"{base}/", "1.0", "weekly"),
        (f"{base}/services", "0.9", "monthly"),
        (f"{base}/projects", "0.8", "monthly"),
        (f"{base}/smart-systems", "0.85", "monthly"),
        (f"{base}/digital-ecosystem", "0.85", "monthly"),
        (f"{base}/work", "0.7", "monthly"),
        (f"{base}/calculator", "0.85", "monthly"),
        (f"{base}/contacts", "0.9", "monthly"),
        (f"{base}/catalog/", "0.95", "weekly"),
    ]
    for loc, priority, changefreq in static_urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")

    # Все товары (Google разрешает до 50k URL в одном sitemap)
    products = cached_data.get("products", []) or []
    for p in products[:50000]:
        model = (p.get("model") or "").strip()
        if not model:
            continue
        encoded = quote(model, safe="")
        loc = f"{base}/catalog/?model={encoded}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.6</priority>")
        # image:image — помогает Google Image Search
        images = p.get("images") or []
        if images:
            img_folder = quote(model, safe="")
            img_url = f"{base}/catalog/portal_export/{img_folder}/{images[0]}"
            img_title = _html_escape((p.get("name") or model)[:120])
            lines.append("    <image:image>")
            lines.append(f"      <image:loc>{img_url}</image:loc>")
            lines.append(f"      <image:title>{img_title}</image:title>")
            lines.append("    </image:image>")
        lines.append("  </url>")
    lines.append("</urlset>")
    xml_body = "\n".join(lines)
    return Response(
        content=xml_body,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/robots.txt", response_class=HttpResponse)
async def robots_txt():
    """robots.txt с указанием sitemap. Nginx может маршрутизировать сюда для каталога."""
    base = SITEMAP_BASE_URL.rstrip("/")
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin\n"
        "Disallow: /api/\n"
        "Disallow: /checkout\n"
        "Disallow: /*?embedded=1\n"
        "\n"
        "User-agent: Googlebot\n"
        "Allow: /\n"
        "\n"
        "User-agent: Yandex\n"
        "Allow: /\n"
        "Clean-param: embedded /\n"
        "\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )
    return HttpResponse(content=body, media_type="text/plain")


@app.get("/products", response_model=ProductsResponse)
async def get_products(
    brand: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    min_quantity: Optional[int] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    cached_data: dict = Depends(get_cached_data)
):
    """
    Получает список товаров

    Query параметры:
    - brand: Фильтр по производителю
    - search: Поиск по названию/модели/бренду
    - category: Фильтр по категории (slug из portal_export, напр. ip-cameras)
    - min_quantity: Минимальный остаток
    - limit: Лимит записей (пагинация)
    - offset: Смещение (пагинация)
    """
    products = cached_data.get("products", [])
    logger.info(f"Получено товаров из кэша: {len(products)}")

    # Обогащаем категорией из portal_export до фильтрации (чтобы фильтр по category работал)
    # Если в portal категория пустая — подставляем по ключевым словам (category_keywords)
    from category_keywords import infer_category as _infer_category
    portal_map = _load_portal_items_map()
    by_model = portal_map.get("by_model", {})
    by_name = portal_map.get("by_name", {})
    for p in products:
        model_key = (p.get("model") or "").upper()
        name_key = (p.get("name") or "").lower()
        item = by_model.get(model_key) or by_name.get(name_key)
        p["category"] = (item.get("category") or "").strip() if item else ""
        if not (p.get("category") or "").strip():
            p["category"] = _infer_category(p)

    all_brands = sorted(set((p.get("brand") or "").strip() for p in products if (p.get("brand") or "").strip()))

    # Применяем фильтры
    if brand:
        products = [p for p in products if (p.get("brand") or "").lower() == brand.lower()]

    if search:
        search_lower = search.strip().lower()
        if search_lower:
            products = [
                p for p in products
                if search_lower in (p.get("name") or "").lower()
                or search_lower in (p.get("model") or "").lower()
                or search_lower in (p.get("brand") or "").lower()
            ]

    if category:
        cat_lower = category.strip().lower()
        if cat_lower:
            products = [p for p in products if (p.get("category") or "").strip().lower() == cat_lower]

    if min_quantity is not None:
        products = [p for p in products if (p.get("quantity") or 0) >= min_quantity]

    total = len(products)
    if limit is not None:
        offset = max(0, offset)
        products = products[offset : offset + limit]
    logger.info(f"Товаров после фильтров: {total}" + (f", срез: {len(products)}" if limit is not None else ""))

    # Картинки из portal_export (category уже выставлена выше; by_model, by_name в scope)
    from urllib.parse import quote
    for p in products:
        try:
            model_encoded = quote(p.get("model", ""), safe="")
            p["image"] = f"/api/products/{model_encoded}/image"
            p["category"] = None
            p["images"] = None
            model_key = (p.get("model") or "").upper()
            name_key = (p.get("name") or "").lower()
            item = by_model.get(model_key) or by_name.get(name_key)
            if item:
                p["category"] = item.get("category") or ""
                imgs = item.get("image")
                if imgs and isinstance(imgs, list):
                    p["images"] = imgs
            # Папка в portal_export: по model_to_foldername и по clean_id (KIT/XVR301 ↔ KIT_XVR301)
            raw_model = p.get("model") or ""
            portal_dir = _portal_folder_for_model(raw_model)
            if portal_dir:
                portal_images = sorted(portal_dir.glob("image_*.*"))
                if portal_images:
                    base = f"/api/products/{model_encoded}/image"
                    p["images"] = [f"{base}?index={i}" for i in range(len(portal_images))]
        except Exception as e:
            logger.warning("Ошибка обработки изображения для товара %s: %s", p.get("model", "unknown"), e)

    logger.info(f"Обработано изображений для {len(products)} товаров")
    
    # Применяем расчет цен и скидок
    from price_manager import calculate_final_price
    
    for p in products:
        try:
            # Получаем и нормализуем price_rrc (розничная цена)
            # В кэше B2B часто приходит price_rrc=0, а актуальная цена — в price_client
            price_rrc_raw = p.get("price_rrc")
            price_client_raw = p.get("price_client")
            
            # Если price_rrc отсутствует или равен 0 — берём price_client как базу
            if price_rrc_raw is None or price_rrc_raw == "" or float(price_rrc_raw or 0) == 0:
                if price_client_raw is not None and price_client_raw != "" and float(price_client_raw or 0) > 0:
                    price_rrc_raw = price_client_raw
                elif price_rrc_raw is None or price_rrc_raw == "":
                    price_rrc_raw = p.get("price") or p.get("cost") or p.get("retail_price")
            
            # Если все еще нет, пробуем другие возможные поля
            if price_rrc_raw is None or price_rrc_raw == "":
                price_rrc_raw = p.get("price") or p.get("cost") or p.get("retail_price")
            
            # Если цена все еще отсутствует, устанавливаем 0 и логируем
            if price_rrc_raw is None or price_rrc_raw == "":
                logger.warning(f"Товар {p.get('model', 'unknown')} не имеет price_rrc, устанавливаем 0")
                price_rrc_raw = 0
            
            # Преобразуем в число, если это строка
            if isinstance(price_rrc_raw, str):
                try:
                    price_rrc = float(price_rrc_raw.replace(',', '.'))
                except (ValueError, AttributeError):
                    price_rrc = 0.0
            elif price_rrc_raw is None:
                price_rrc = 0.0
            else:
                try:
                    price_rrc = float(price_rrc_raw)
                except (ValueError, TypeError):
                    price_rrc = 0.0
            
            # Проверяем валидность цены
            if price_rrc < 0 or not isinstance(price_rrc, (int, float)):
                price_rrc = 0.0
            
            model = p.get("model", "") or ""
            brand = p.get("brand", "") or ""
            
            # Рассчитываем итоговую цену со скидкой
            price_info = calculate_final_price(price_rrc, model, brand)
            
            # Обновляем данные товара
            p["final_price"] = float(price_info["final_price"])
            p["discount"] = float(price_info["discount"])
            p["discount_amount"] = float(price_info["discount_amount"])
            
            # Убеждаемся, что price_rrc тоже число
            p["price_rrc"] = float(price_rrc)
            
            # Удаляем старое поле price_client если оно есть
            p.pop("price_client", None)
        except Exception as e:
            logger.warning(f"Ошибка расчета цены для товара {p.get('model', 'unknown')}: {e}")
            logger.debug(f"Данные товара: {p}")
            # Устанавливаем значения по умолчанию
            try:
                price_rrc_default = float(p.get("price_rrc", 0) or 0)
                if price_rrc_default < 0:
                    price_rrc_default = 0.0
            except (ValueError, TypeError):
                price_rrc_default = 0.0
            
            p["price_rrc"] = price_rrc_default
            p["final_price"] = price_rrc_default
            p["discount"] = 0.0
            p["discount_amount"] = 0.0
    
    # Валидация через Pydantic с обработкой ошибок
    validated_products = []
    for p in products:
        try:
            # Дополнительная проверка: если price_rrc так и остался 0, пробуем price_client
            if "price_rrc" not in p or p["price_rrc"] is None or float(p.get("price_rrc") or 0) == 0:
                fallback_price = p.get("price_client") or p.get("price") or p.get("cost") or p.get("retail_price") or 0
                try:
                    val = float(fallback_price)
                    if val > 0:
                        p["price_rrc"] = val
                        if p.get("final_price") is None or float(p.get("final_price") or 0) == 0:
                            from price_manager import calculate_final_price
                            info = calculate_final_price(val, p.get("model", ""), p.get("brand", ""))
                            p["final_price"] = info["final_price"]
                            p["discount"] = info["discount"]
                            p["discount_amount"] = info["discount_amount"]
                except (ValueError, TypeError):
                    pass
                if float(p.get("price_rrc") or 0) == 0:
                    p["price_rrc"] = 0.0
            
            if "final_price" not in p or p["final_price"] is None:
                logger.warning(f"Товар {p.get('model', 'unknown')} не имеет final_price, используем price_rrc")
                p["final_price"] = float(p.get("price_rrc", 0))
            
            # Убеждаемся, что все числовые поля - числа
            p["price_rrc"] = float(p["price_rrc"])
            p["final_price"] = float(p["final_price"])
            p["discount"] = float(p.get("discount", 0))
            p["discount_amount"] = float(p.get("discount_amount", 0))
            
            validated_products.append(Product(**p))
        except Exception as e:
            logger.warning(f"Ошибка валидации товара {p.get('model', 'unknown')}: {e}")
            logger.debug(f"Данные товара: {p}")
            # Пропускаем товары с ошибками валидации, но продолжаем обработку остальных
            continue
    
    logger.info(f"Валидировано товаров: {len(validated_products)}")
    
    return ProductsResponse(
        updated=cached_data.get("updated"),
        count=len(validated_products),
        products=validated_products,
        total=total if limit is not None else None,
        limit=limit,
        offset=offset if limit is not None else None,
        brands=all_brands,
    )


@app.get("/products/{model:path}", response_model=Product)
async def get_product_by_model(
    model: str,
    cached_data: dict = Depends(get_cached_data)
):
    """Получает товар по модели"""
    from price_manager import calculate_final_price
    
    products = cached_data.get("products", [])
    product_data = next(
        (p for p in products if p.get("model", "").lower() == model.lower()),
        None
    )
    
    if not product_data:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Применяем расчет цен
    # В кэше часто price_rrc=0, актуальная цена в price_client
    price_rrc_raw = product_data.get("price_rrc")
    price_client_raw = product_data.get("price_client")
    
    if price_rrc_raw is None or price_rrc_raw == "" or float(price_rrc_raw or 0) == 0:
        if price_client_raw is not None and price_client_raw != "" and float(price_client_raw or 0) > 0:
            price_rrc_raw = price_client_raw
        elif price_rrc_raw is None or price_rrc_raw == "":
            price_rrc_raw = product_data.get("price") or product_data.get("cost") or product_data.get("retail_price")
    
    if price_rrc_raw is None or price_rrc_raw == "":
        logger.warning(f"Товар {model} не имеет price_rrc, устанавливаем 0")
        price_rrc_raw = 0
    
    # Преобразуем в число, если это строка
    if isinstance(price_rrc_raw, str):
        try:
            price_rrc = float(price_rrc_raw.replace(',', '.'))
        except (ValueError, AttributeError):
            price_rrc = 0.0
    elif price_rrc_raw is None:
        price_rrc = 0.0
    else:
        try:
            price_rrc = float(price_rrc_raw)
        except (ValueError, TypeError):
            price_rrc = 0.0
    
    if price_rrc < 0:
        price_rrc = 0.0
    
    brand = product_data.get("brand", "") or ""
    price_info = calculate_final_price(price_rrc, model, brand)
    
    product_data["price_rrc"] = float(price_rrc)
    product_data["final_price"] = float(price_info["final_price"])
    product_data["discount"] = float(price_info["discount"])
    product_data["discount_amount"] = float(price_info["discount_amount"])
    product_data.pop("price_client", None)
    
    return Product(**product_data)


@app.get("/health", response_model=HealthResponse)
async def health(cached_data: dict = Depends(get_cached_data)):
    """Проверка здоровья сервиса"""
    return HealthResponse(
        status="ok",
        last_update=cached_data.get("updated") if cached_data else None,
        products_count=len(cached_data.get("products", [])) if cached_data else 0
    )


@app.get("/api/test/image/{model}")
async def test_image_url(model: str, cached_data: dict = Depends(get_cached_data)):
    """Тестовый эндпоинт для проверки URL изображения"""
    try:
        products = cached_data.get("products", [])
        product = next(
            (p for p in products if p.get("model", "").lower() == model.lower()),
            None
        )
        
        if not product:
            return {
                "status": "error",
                "message": "Товар не найден"
            }
        
        brand = product.get('brand', '')
        name = product.get('name', '')
        
        from product_image_parser import normalize_image_url
        from config import B2B_API_BASE_URL
        
        # Проверяем локальные изображения
        images_dir = Path(__file__).parent / "images" / model
        local_images = []
        if images_dir.exists() and images_dir.is_dir():
            local_images = [str(f.name) for f in images_dir.glob("*.*")]
        
        # Генерируем варианты URL из кэша
        cache_urls = [
            f"{B2B_API_BASE_URL}/image/cache/catalog/{model}_1-360x360.jpg",
            f"{B2B_API_BASE_URL}/image/cache/catalog/{model}_1.jpg",
            f"{B2B_API_BASE_URL}/image/cache/catalog/{model}-360x360.jpg",
            f"{B2B_API_BASE_URL}/image/cache/catalog/{model}.jpg",
        ]
        
        # Нормализуем к оригиналу
        original_urls = []
        for cache_url in cache_urls:
            original = normalize_image_url(cache_url)
            if original:
                original_urls.append(original)
        
        # Проверяем доступность оригинальных URL
        available_images = []
        for url in original_urls[:2]:  # Проверяем первые 2
            try:
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda u=url: requests.head(u, timeout=3, allow_redirects=True)
                )
                if response.status_code == 200:
                    available_images.append(url)
            except:
                pass
        
        return {
            "model": model,
            "brand": brand,
            "name": name,
            "local_images": local_images,
            "cache_urls": cache_urls,
            "original_urls": original_urls,
            "available_images": available_images,
            "primary_image": local_images[0] if local_images else (available_images[0] if available_images else None)
        }
    except Exception as e:
        logger.error(f"Ошибка при проверке изображения: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@app.post("/api/parse-images/start")
async def start_image_parsing(request: Request, max_pages: Optional[int] = 5):
    """Запускает парсинг изображений"""
    require_admin_auth(request)
    """
    Запускает парсинг изображений товаров с сайта
    
    Args:
        max_pages: Максимальное количество страниц каталога для парсинга
    """
    if image_parser_state.get("running"):
        raise HTTPException(status_code=409, detail="Парсер уже запущен")

    image_parser_state["running"] = True
    try:
        from product_image_parser import parse_catalog, download_images_for_products, load_parser_cache
        
        # Загружаем кэш обработанных товаров и изображений
        load_parser_cache()
        
        logger.info(f"Запуск парсинга изображений (max_pages={max_pages})")
        
        # Парсим каталог
        loop = asyncio.get_running_loop()
        products_images = await loop.run_in_executor(
            None,
            parse_catalog,
            max_pages
        )
        
        if not products_images:
            return {
                "status": "warning",
                "message": "Не найдено товаров с изображениями",
                "products_count": 0
            }
        
        # Скачиваем изображения сразу после парсинга всех страниц
        # Изображения сохраняются в images/{model}/ и сразу доступны через API
        downloaded = await loop.run_in_executor(
            None,
            lambda: download_images_for_products(products_images, download_immediately=True)
        )
        
        total_downloaded = sum(downloaded.values())

        image_parser_state["last_run"] = time.time()
        
        return {
            "status": "success",
            "message": "Парсинг завершен",
            "products_count": len(products_images),
            "images_downloaded": total_downloaded,
            "details": downloaded
        }
    except Exception as e:
        logger.error(f"Ошибка при парсинге изображений: {e}")
        image_parser_state["last_run"] = time.time()
        return {
            "status": "error",
            "message": str(e)
        }
    finally:
        image_parser_state["running"] = False


@app.get("/api/parse-images/cache")
async def get_parse_images_cache(request: Request):
    """Получает информацию о кэше парсера"""
    require_admin_auth(request)
    """Получает информацию о кэше парсера (обработанные товары и изображения)"""
    try:
        from product_image_parser import PARSER_CACHE_FILE
        import json
        
        # Загружаем кэш из файла
        cache_data = {
            "processed_models": [],
            "processed_images": [],
            "processed_pages": []
        }
        
        if PARSER_CACHE_FILE.exists():
            try:
                with open(PARSER_CACHE_FILE, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
            except Exception as e:
                logger.warning(f"Не удалось загрузить кэш: {e}")
        
        # Подсчитываем статистику по локальным изображениям
        images_dir = Path(__file__).parent / "images"
        local_models = []
        total_local_images = 0
        
        if images_dir.exists():
            for model_dir in images_dir.iterdir():
                if model_dir.is_dir():
                    images = list(model_dir.glob("*.*"))
                    if images:
                        local_models.append({
                            "model": model_dir.name,
                            "images_count": len(images)
                        })
                        total_local_images += len(images)
        
        return {
            "cache_file": str(PARSER_CACHE_FILE),
            "processed_models_count": len(cache_data.get("processed_models", [])),
            "processed_images_count": len(cache_data.get("processed_images", [])),
            "processed_pages_count": len(cache_data.get("processed_pages", [])),
            "local_models_count": len(local_models),
            "total_local_images": total_local_images,
            "sample_processed_models": cache_data.get("processed_models", [])[:20],
            "local_models_sample": local_models[:20]
        }
    except Exception as e:
        logger.error(f"Ошибка при получении кэша парсера: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@app.post("/api/parse-images/clear-cache")
async def clear_parse_images_cache(request: Request):
    """Очищает кэш парсера"""
    require_admin_auth(request)
    """Очищает кэш парсера (обработанные товары и изображения)"""
    try:
        from product_image_parser import PARSER_CACHE_FILE
        
        # Удаляем файл кэша
        if PARSER_CACHE_FILE.exists():
            PARSER_CACHE_FILE.unlink()
            logger.info("Кэш парсера очищен")
            return {
                "status": "success",
                "message": "Кэш парсера очищен. При следующем запуске парсер начнет с начала."
            }
        else:
            return {
                "status": "info",
                "message": "Кэш парсера уже пуст"
            }
    except Exception as e:
        logger.error(f"Ошибка при очистке кэша парсера: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@app.get("/api/parse-images/stats")
async def get_parsed_images_stats(request: Request):
    """Возвращает статистику по спарсенным изображениям"""
    require_admin_auth(request)
    """Возвращает статистику по спарсенным изображениям"""
    try:
        images_dir = Path(__file__).parent / "images"
        
        if not images_dir.exists():
            return {
                "total_products": 0,
                "total_images": 0,
                "products": {},
                "parser_status": {
                    "enabled": IMAGE_PARSER_ENABLED,
                    "running": image_parser_state.get("running", False),
                    "last_run": image_parser_state.get("last_run")
                }
            }
        
        products = {}
        total_images = 0
        
        for product_dir in images_dir.iterdir():
            if product_dir.is_dir():
                image_files = list(product_dir.glob("*.*"))
                image_count = len(image_files)
                products[product_dir.name] = {
                    "images_count": image_count,
                    "images": [f.name for f in image_files]
                }
                total_images += image_count
        
        return {
            "total_products": len(products),
            "total_images": total_images,
            "products": products,
            "parser_status": {
                "enabled": IMAGE_PARSER_ENABLED,
                "running": image_parser_state.get("running", False),
                "last_run": image_parser_state.get("last_run")
            }
        }
    except Exception as e:
        logger.error(f"Ошибка при получении статистики: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


# ==================== API для управления ценами и скидками ====================

class DiscountRequest(BaseModel):
    discount: float

class ModelDiscountRequest(BaseModel):
    model: str
    discount: float

class BrandDiscountRequest(BaseModel):
    brand: str
    discount: float

class CustomPriceRequest(BaseModel):
    model: str
    price: float


class AssistantChatRequest(BaseModel):
    message: str
    budget: Optional[float] = None
    brands: Optional[list[str]] = None
    cart: Optional[list[str]] = None


class AssistantChatResponse(BaseModel):
    text: str
    product_models: list[str] = []


# ==================== API для корзины ====================

class CartItem(BaseModel):
    model: str
    name: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    quantity: int = 1


class CartRequest(BaseModel):
    items: list[CartItem]


class AddItemRequest(BaseModel):
    item: CartItem
    quantity: int = 1


class CheckoutDelivery(BaseModel):
    type: str = ""
    address: str = ""
    phone: str = ""


class CheckoutSubmitRequest(BaseModel):
    items: list[CartItem]
    installation: str = "none"
    delivery: CheckoutDelivery = CheckoutDelivery()
    payment: str = ""
    comment: str = ""
    total: Optional[float] = None
    date: Optional[str] = None


class AdminLoginRequest(BaseModel):
    login: str
    password: str


class ContactsSubmitRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    projectType: Optional[str] = None
    message: Optional[str] = None


def _send_order_email_sync(
    to_email: str,
    subject: str,
    body_plain: str,
    body_html: Optional[str] = None,
    attachment: Optional[tuple] = None,  # (filename: str, data: bytes)
) -> None:
    """Синхронная отправка письма через SMTP. Вызывать из run_in_executor."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.application import MIMEApplication
    from email.utils import formatdate

    if attachment:
        # mixed: text/html + PDF attachment
        msg = MIMEMultipart("mixed")
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(body_plain, "plain", "utf-8"))
        if body_html:
            alt.attach(MIMEText(body_html, "html", "utf-8"))
        msg.attach(alt)
        fname, fbytes = attachment
        pdf_part = MIMEApplication(fbytes, _subtype="pdf")
        pdf_part.add_header("Content-Disposition", "attachment", filename=fname)
        msg.attach(pdf_part)
    elif body_html:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(body_plain, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))
    else:
        msg = MIMEText(body_plain, "plain", "utf-8")

    msg["Subject"] = subject
    msg["From"] = SMTP_USER or to_email
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)

    # Для порта 465 используется SSL напрямую (SMTP_SSL)
    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())
    elif SMTP_USE_TLS:
        # Для порта 587 используется STARTTLS
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())
    else:
        # Обычное SMTP без шифрования (не рекомендуется)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())


@app.post("/api/checkout/submit")
async def checkout_submit(payload: CheckoutSubmitRequest):
    """Принимает данные заказа и отправляет их на email админа."""
    if not ADMIN_EMAIL:
        logger.warning("Checkout submit: ADMIN_EMAIL не задан, отправка заказов отключена")
        raise HTTPException(
            status_code=503,
            detail="Отправка заказов не настроена. Обратитесь к администратору.",
        )

    # Человекочитаемые подписи для способов доставки, оплаты и монтажа
    DELIVERY_LABELS = {
        "transport": "Транспортная компания",
        "courier": "Курьерская доставка",
        "pickup1": "Самовывоз (склад 1)",
        "pickup3": "Самовывоз (склад 3)",
    }
    PAYMENT_LABELS = {
        "cash": "Наличными",
        "transfer": "Банковский перевод",
        "card": "Оплата картой",
        "kaspi": "Kaspi рассрочка/оплата",
    }
    INSTALLATION_LABELS = {
        "none": "Не требуется",
        "professional": "Профессиональный монтаж",
    }

    import datetime
    if payload.date:
        try:
            dt = datetime.datetime.fromisoformat(payload.date.replace("Z", "+00:00"))
            if dt.tzinfo:
                dt = dt.astimezone().replace(tzinfo=None)
            order_date_str = dt.strftime("%d.%m.%Y, %H:%M")
        except Exception:
            order_date_str = payload.date
    else:
        order_date_str = datetime.datetime.now().strftime("%d.%m.%Y, %H:%M")

    delivery_label = DELIVERY_LABELS.get((payload.delivery.type or "").strip(), payload.delivery.type or "—")
    payment_label = PAYMENT_LABELS.get((payload.payment or "").strip(), payload.payment or "—")
    installation_label = INSTALLATION_LABELS.get((payload.installation or "").strip(), payload.installation or "—")

    total_sum = payload.total if payload.total is not None else 0
    total_str = f"{total_sum:,.0f} ₸".replace(",", " ") if total_sum else "—"

    # ——— Текстовое письмо (удобно для поиска и копирования) ———
    lines = [
        "Новый заказ с сайта grgroup.kz (B2B каталог)",
        "=" * 50,
        "",
        "Дата и время заказа:  " + order_date_str,
        "Количество позиций:   " + str(len(payload.items)),
        "Сумма заказа:         " + total_str,
        "",
        "┌────────────────────────────────────────────────────────────",
        "│  СОСТАВ ЗАКАЗА",
        "└────────────────────────────────────────────────────────────",
        "",
    ]
    for idx, item in enumerate(payload.items, 1):
        name = (item.name or item.model or "—").strip()
        price_str = f"{item.price:,.0f} ₸".replace(",", " ") if item.price is not None else "по запросу"
        qty = item.quantity or 0
        line_sum = ""
        if item.price is not None and qty:
            line_sum = f"  →  {item.price * qty:,.0f} ₸".replace(",", " ")
        lines.append(f"  {idx}. {item.model}")
        lines.append(f"     Наименование: {name}")
        lines.append(f"     Количество:   {qty} шт.")
        lines.append(f"     Цена за ед.:  {price_str}{line_sum}")
        lines.append("")
    lines.extend([
        "┌────────────────────────────────────────────────────────────",
        "│  ДОСТАВКА",
        "└────────────────────────────────────────────────────────────",
        "",
        "  Способ доставки:  " + delivery_label,
        "  Адрес:           " + (payload.delivery.address or "—"),
        "  Телефон:         " + (payload.delivery.phone or "—"),
        "",
        "┌────────────────────────────────────────────────────────────",
        "│  ОПЛАТА И МОНТАЖ",
        "└────────────────────────────────────────────────────────────",
        "",
        "  Способ оплаты:   " + payment_label,
        "  Монтаж:          " + installation_label,
        "",
        "┌────────────────────────────────────────────────────────────",
        "│  ИТОГО К ОПЛАТЕ:  " + total_str,
        "└────────────────────────────────────────────────────────────",
        "",
    ])
    if payload.comment and payload.comment.strip():
        lines.extend([
            "Комментарий клиента:",
            "-" * 40,
            payload.comment.strip(),
            "",
        ])
    lines.append("— Конец заказа —")
    body_plain = "\n".join(lines)

    # ——— HTML-письмо (удобный просмотр в почтовом клиенте) ———
    from html import escape as html_escape
    rows_html = []
    for idx, item in enumerate(payload.items, 1):
        name = (item.name or item.model or "—").strip()
        price_val = item.price
        qty = item.quantity or 0
        price_str = f"{price_val:,.0f} ₸".replace(",", " ") if price_val is not None else "по запросу"
        line_sum = ""
        if price_val is not None and qty:
            line_sum = f"{price_val * qty:,.0f} ₸".replace(",", " ")
        rows_html.append(
            f"<tr><td>{idx}</td><td>{html_escape(item.model)}</td><td>{html_escape(name)}</td>"
            f"<td>{qty}</td><td>{price_str}</td><td>{line_sum}</td></tr>"
        )
    items_table = "\n".join(rows_html)
    body_html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333; max-width: 640px; }}
    h1 {{ font-size: 18px; color: #1a1a1a; border-bottom: 2px solid #4a90d9; padding-bottom: 8px; }}
    h2 {{ font-size: 14px; color: #4a90d9; margin-top: 20px; margin-bottom: 8px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
    th, td {{ border: 1px solid #ddd; padding: 8px 10px; text-align: left; }}
    th {{ background: #f5f5f5; font-weight: 600; }}
    .meta {{ background: #f9f9f9; padding: 12px; border-radius: 6px; margin: 12px 0; }}
    .meta p {{ margin: 4px 0; }}
    .total {{ font-size: 16px; font-weight: bold; color: #1a1a1a; margin-top: 12px; }}
    .comment {{ background: #fffbe6; padding: 10px; border-left: 4px solid #d4a012; margin-top: 12px; }}
  </style>
</head>
<body>
  <h1>Новый заказ с сайта grgroup.kz</h1>
  <p style="color:#666;">B2B каталог — форма checkout</p>

  <div class="meta">
    <p><strong>Дата и время:</strong> {order_date_str}</p>
    <p><strong>Позиций в заказе:</strong> {len(payload.items)}</p>
    <p><strong>Сумма заказа:</strong> {total_str}</p>
  </div>

  <h2>Состав заказа</h2>
  <table>
    <thead><tr><th>№</th><th>Модель</th><th>Наименование</th><th>Кол-во</th><th>Цена за ед.</th><th>Сумма</th></tr></thead>
    <tbody>
      {items_table}
    </tbody>
  </table>

  <h2>Доставка</h2>
  <table>
    <tr><td><strong>Способ</strong></td><td>{html_escape(delivery_label)}</td></tr>
    <tr><td><strong>Адрес</strong></td><td>{html_escape(payload.delivery.address or "—")}</td></tr>
    <tr><td><strong>Телефон</strong></td><td>{html_escape(payload.delivery.phone or "—")}</td></tr>
  </table>

  <h2>Оплата и монтаж</h2>
  <table>
    <tr><td><strong>Способ оплаты</strong></td><td>{html_escape(payment_label)}</td></tr>
    <tr><td><strong>Монтаж</strong></td><td>{html_escape(installation_label)}</td></tr>
  </table>

  <p class="total">Итого к оплате: {total_str}</p>
"""
    if payload.comment and payload.comment.strip():
        body_html += f'  <div class="comment"><strong>Комментарий клиента:</strong><br>{html_escape(payload.comment.strip())}</div>\n'
    body_html += "</body>\n</html>"

    subject = f"Новый заказ — {order_date_str} — {total_str}"

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _send_order_email_sync,
            ADMIN_EMAIL,
            subject,
            body_plain,
            body_html,
        )
    except Exception as e:
        logger.exception("Ошибка отправки заказа на email (SMTP)")
        raise HTTPException(
            status_code=500,
            detail="Не удалось отправить заказ. Попробуйте позже.",
        )

    return JSONResponse(content={"ok": True})


# Человекочитаемые подписи для типа проекта (форма контактов)
PROJECT_TYPE_LABELS = {
    "apartment": "Квартира",
    "house": "Частный дом",
    "office": "Офис",
    "commercial": "Коммерческое помещение",
    "other": "Другое",
}


@app.post("/api/contacts/submit")
async def contacts_submit(payload: ContactsSubmitRequest):
    """Принимает данные заявки с страницы контактов и отправляет на email админа."""
    if not ADMIN_EMAIL:
        logger.warning("Contacts submit: ADMIN_EMAIL не задан")
        raise HTTPException(
            status_code=503,
            detail="Отправка заявок не настроена. Обратитесь к администратору.",
        )

    import datetime
    from html import escape as html_escape

    now_str = datetime.datetime.now().strftime("%d.%m.%Y, %H:%M")
    is_calculator = (payload.projectType or "").strip().lower() == "calculator"
    project_label = "Калькулятор видеонаблюдения" if is_calculator else PROJECT_TYPE_LABELS.get((payload.projectType or "").strip(), payload.projectType or "—")
    email_title = "Заявка с калькулятора видеонаблюдения (grgroup.kz)" if is_calculator else "Заявка с сайта grgroup.kz (Контакты)"

    # ——— Текстовое письмо ———
    lines = [
        email_title,
        "=" * 50,
        "",
        "Дата и время:  " + now_str,
        "",
        "┌────────────────────────────────────────────────────────────",
        "│  КОНТАКТНЫЕ ДАННЫЕ",
        "└────────────────────────────────────────────────────────────",
        "",
        "  Имя:         " + (payload.name or "—"),
        "  Телефон:     " + (payload.phone or "—"),
        "  Email:       " + (payload.email or "—"),
        "  Тип проекта: " + project_label,
        "",
        "┌────────────────────────────────────────────────────────────",
        "│  СООБЩЕНИЕ",
        "└────────────────────────────────────────────────────────────",
        "",
        (payload.message or "—").strip(),
        "",
        "— Конец заявки —",
    ]
    body_plain = "\n".join(lines)

    # ——— HTML-письмо ———
    body_html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333; max-width: 640px; }}
    h1 {{ font-size: 18px; color: #1a1a1a; border-bottom: 2px solid #4a90d9; padding-bottom: 8px; }}
    h2 {{ font-size: 14px; color: #4a90d9; margin-top: 20px; margin-bottom: 8px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
    th, td {{ border: 1px solid #ddd; padding: 8px 10px; text-align: left; }}
    th {{ background: #f5f5f5; font-weight: 600; }}
    .meta {{ background: #f9f9f9; padding: 12px; border-radius: 6px; margin: 12px 0; }}
    .message {{ background: #f5f5f5; padding: 12px; border-radius: 6px; white-space: pre-wrap; }}
  </style>
</head>
<body>
  <h1>{html_escape(email_title)}</h1>
  <div class="meta">
    <p><strong>Дата и время:</strong> {now_str}</p>
  </div>
  <h2>Контактные данные</h2>
  <table>
    <tr><td><strong>Имя</strong></td><td>{html_escape(payload.name or "—")}</td></tr>
    <tr><td><strong>Телефон</strong></td><td>{html_escape(payload.phone or "—")}</td></tr>
    <tr><td><strong>Email</strong></td><td>{html_escape(payload.email or "—")}</td></tr>
    <tr><td><strong>Тип проекта</strong></td><td>{html_escape(project_label)}</td></tr>
  </table>
  <h2>Сообщение / расчёт</h2>
  <div class="message">{html_escape((payload.message or "—").strip())}</div>
</body>
</html>
"""

    subject = f"Заявка с калькулятора видеонаблюдения — {now_str} — {payload.name or 'Без имени'}" if is_calculator else f"Заявка с сайта (Контакты) — {now_str} — {payload.name or 'Без имени'}"

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _send_order_email_sync,
            ADMIN_EMAIL,
            subject,
            body_plain,
            body_html,
        )
    except Exception as e:
        logger.exception("Ошибка отправки заявки с контактов на email (SMTP)")
        raise HTTPException(
            status_code=500,
            detail="Не удалось отправить заявку. Попробуйте позже.",
        ) from e

    return JSONResponse(content={"ok": True})


class SendKPRequest(BaseModel):
    complexName: str = Field(..., min_length=2, max_length=200)
    address: str = Field(..., min_length=5, max_length=500)
    phone: str = Field(..., min_length=7, max_length=50)
    email: str = Field(..., max_length=254)
    documentType: Literal['kpfull', 'finmodel']
    pdfBase64: str = Field(..., max_length=15_000_000)  # ~10 MB PDF
    fileName: str = Field(..., max_length=255)


@app.post("/api/calculator/send-kp")
async def send_kp(payload: SendKPRequest):
    """Принимает PDF base64 и рассылает его клиенту + копию администратору."""
    if not ADMIN_EMAIL:
        logger.warning("send_kp: ADMIN_EMAIL не задан")
        raise HTTPException(status_code=503, detail="Сервис отправки писем не настроен.")

    try:
        pdf_bytes = base64.b64decode(payload.pdfBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="Некорректные данные PDF.")

    doc_name = (
        "Коммерческое предложение"
        if payload.documentType == "kpfull"
        else "Финансовая модель"
    )

    subject_client = f"{doc_name} для ЖК «{payload.complexName}» — G&R Group"
    subject_admin = (
        f"[НОВЫЙ ЛИД] {doc_name} — ЖК «{payload.complexName}» | {payload.phone}"
    )

    body_client = (
        f"Здравствуйте!\n\n"
        f"Высылаем {doc_name.lower()} для вашего объекта.\n\n"
        f"Объект: ЖК «{payload.complexName}»\n"
        f"Адрес:  {payload.address}\n\n"
        f"{doc_name} прикреплён к этому письму.\n\n"
        f"С уважением,\n"
        f"ТОО «G&R Group»\n"
        f"+7 771 421 55 93 | info@grgroup.kz"
    )

    body_admin = (
        f"Новый лид с калькулятора\n\n"
        f"Документ: {doc_name}\n"
        f"ЖК:       {payload.complexName}\n"
        f"Адрес:    {payload.address}\n"
        f"Телефон:  {payload.phone}\n"
        f"Email:    {payload.email}\n\n"
        f"{doc_name} прикреплён к письму."
    )

    attachment = (payload.fileName, pdf_bytes)
    loop = asyncio.get_running_loop()
    errors: list[str] = []

    # Письмо клиенту
    try:
        await loop.run_in_executor(
            None,
            _send_order_email_sync,
            payload.email,
            subject_client,
            body_client,
            None,
            attachment,
        )
    except Exception:
        logger.exception("send_kp: ошибка отправки клиенту")
        errors.append("client")

    # Копия администратору
    try:
        await loop.run_in_executor(
            None,
            _send_order_email_sync,
            ADMIN_EMAIL,
            subject_admin,
            body_admin,
            None,
            attachment,
        )
    except Exception:
        logger.exception("send_kp: ошибка отправки администратору")
        errors.append("admin")

    if len(errors) == 2:
        raise HTTPException(
            status_code=500,
            detail="Не удалось отправить письма. Попробуйте позже.",
        )

    return {"success": True}


@app.get("/api/cart")
async def get_cart(request: Request, response: Response):
    """Получает корзину пользователя"""
    try:
        session_id = get_or_create_session_id(request, response)
        with _cart_storage_lock:
            cart = _cart_storage.get(session_id, [])
        # Return a plain dict so FastAPI reuses `response` with Set-Cookie applied.
        return {"items": cart}
    except Exception as e:
        logger.error(f"Ошибка при получении корзины: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cart")
async def save_cart(request: Request, response: Response, cart_request: CartRequest):
    """Сохраняет корзину пользователя"""
    try:
        session_id = get_or_create_session_id(request, response)
        # Валидация и нормализация данных
        items = []
        for item in cart_request.items:
            if not item.model or not item.model.strip():
                continue
            items.append({
                "model": item.model.strip(),
                "name": item.name.strip() if item.name else None,
                "brand": item.brand.strip() if item.brand else None,
                "price": float(item.price) if item.price is not None and not (isinstance(item.price, float) and (item.price != item.price or item.price == float('inf'))) else None,
                "quantity": max(1, int(item.quantity)) if item.quantity else 1
            })
        
        with _cart_storage_lock:
            _cart_storage[session_id] = items
        
        return {"status": "success", "items": items}
    except Exception as e:
        logger.error(f"Ошибка при сохранении корзины: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/cart")
async def clear_cart(request: Request, response: Response):
    """Очищает корзину пользователя"""
    try:
        session_id = get_or_create_session_id(request, response)
        with _cart_storage_lock:
            _cart_storage[session_id] = []
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Ошибка при очистке корзины: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cart/items")
async def add_item_to_cart(request: Request, response: Response, add_request: AddItemRequest):
    """Добавляет товар в корзину"""
    try:
        session_id = get_or_create_session_id(request, response)
        if not add_request.item.model or not add_request.item.model.strip():
            raise HTTPException(status_code=400, detail="Model is required")
        
        new_item = {
            "model": add_request.item.model.strip(),
            "name": add_request.item.name.strip() if add_request.item.name else None,
            "brand": add_request.item.brand.strip() if add_request.item.brand else None,
            "price": float(add_request.item.price) if add_request.item.price is not None and not (isinstance(add_request.item.price, float) and (add_request.item.price != add_request.item.price or add_request.item.price == float('inf'))) else None,
            "quantity": max(1, int(add_request.quantity)) if add_request.quantity else 1
        }
        
        with _cart_storage_lock:
            cart = _cart_storage.get(session_id, [])
            # Ищем существующий товар
            existing_index = None
            for i, item in enumerate(cart):
                if item.get("model", "").strip() == new_item["model"]:
                    existing_index = i
                    break
            
            if existing_index is not None:
                # Увеличиваем количество
                cart[existing_index]["quantity"] += new_item["quantity"]
            else:
                # Добавляем новый товар
                cart.append(new_item)
            
            _cart_storage[session_id] = cart
        
        return {"status": "success", "items": cart}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при добавлении товара в корзину: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/cart/items/{model}")
async def remove_item_from_cart(request: Request, response: Response, model: str):
    """Удаляет товар из корзины"""
    try:
        session_id = get_or_create_session_id(request, response)
        model = model.strip()
        
        with _cart_storage_lock:
            cart = _cart_storage.get(session_id, [])
            cart = [item for item in cart if item.get("model", "").strip() != model]
            _cart_storage[session_id] = cart
        
        return {"status": "success", "items": cart}
    except Exception as e:
        logger.error(f"Ошибка при удалении товара из корзины: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/login")
async def admin_login(request: Request, response: Response, login_data: AdminLoginRequest):
    """Авторизация админа (с защитой от брутфорса по IP)."""
    _check_admin_bruteforce(request)
    # Используем timing-safe сравнение для защиты от timing attacks
    login_ok = secrets.compare_digest(login_data.login.strip(), ADMIN_LOGIN)
    password_ok = secrets.compare_digest(login_data.password, ADMIN_PASSWORD)
    if login_ok and password_ok:
        _clear_admin_login_fail(request)
        create_admin_session(response, request)
        return {"ok": True}
    _record_admin_login_fail(request)
    raise HTTPException(status_code=401, detail="Неверный логин или пароль")


@app.get("/api/admin/check")
async def admin_check(request: Request):
    """Проверка авторизации админа"""
    return {"authenticated": is_admin_authenticated(request)}


@app.post("/api/admin/logout")
async def admin_logout(request: Request, response: Response):
    """Выход из админки"""
    remove_admin_session(request, response)
    return {"ok": True}


@app.get("/api/admin/satu/export-excel")
def download_satu_excel(request: Request):
    """
    Генерирует Excel для импорта в SATU из API (B2B + слияние с portal_export) и отдаёт файл на скачивание.
    Доступно только авторизованному админу. Ссылки на изображения — через API сайта (SITEMAP_BASE_URL).
    """
    require_admin_auth(request)
    try:
        from export_satu_excel import load_products_for_satu, build_full_excel, ensure_product_images
        ensure_product_images(PORTAL_EXPORT_DIR)
        products = load_products_for_satu(from_api=True, limit=None)
        if not products:
            raise HTTPException(status_code=404, detail="Товары не найдены в API/кэше.")
        api_base = (SITEMAP_BASE_URL or "").strip().rstrip("/") or None
        wb, _count = build_full_excel(
            products,
            limit=None,
            image_via_api=True,
            api_base_url=api_base,
        )
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return HttpResponse(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=satu_import.xlsx"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("SATU Excel export failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/prices")
async def get_prices(request: Request):
    """Получает все настройки цен и скидок"""
    require_admin_auth(request)
    """Получает все настройки цен и скидок"""
    try:
        from price_manager import get_all_discounts
        return get_all_discounts()
    except Exception as e:
        logger.error(f"Ошибка при получении настроек цен: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/prices/global-discount")
async def set_global_discount(request: Request, discount_request: DiscountRequest):
    """Устанавливает глобальную скидку (0-100%)"""
    require_admin_auth(request)
    try:
        from price_manager import set_global_discount
        if set_global_discount(discount_request.discount):
            return {"status": "success", "message": f"Глобальная скидка установлена: {discount_request.discount}%"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ошибка при установке глобальной скидки: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/prices/model-discount")
async def set_model_discount(request: Request, model_discount_request: ModelDiscountRequest):
    """Устанавливает скидку для конкретной модели"""
    require_admin_auth(request)
    try:
        from price_manager import set_model_discount
        if set_model_discount(model_discount_request.model, model_discount_request.discount):
            return {"status": "success", "message": f"Скидка для модели {model_discount_request.model} установлена: {model_discount_request.discount}%"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ошибка при установке скидки для модели: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/prices/model-discount/{model}")
async def remove_model_discount(request: Request, model: str):
    """Удаляет скидку для конкретной модели"""
    require_admin_auth(request)
    try:
        from price_manager import remove_model_discount
        if remove_model_discount(model):
            return {"status": "success", "message": f"Скидка для модели {model} удалена"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except Exception as e:
        logger.error(f"Ошибка при удалении скидки для модели: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/prices/brand-discount")
async def set_brand_discount(request: Request, brand_discount_request: BrandDiscountRequest):
    """Устанавливает скидку для бренда"""
    require_admin_auth(request)
    try:
        from price_manager import set_brand_discount
        if set_brand_discount(brand_discount_request.brand, brand_discount_request.discount):
            return {"status": "success", "message": f"Скидка для бренда {brand_discount_request.brand} установлена: {brand_discount_request.discount}%"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ошибка при установке скидки для бренда: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/prices/brand-discount/{brand}")
async def remove_brand_discount(request: Request, brand: str):
    """Удаляет скидку для бренда"""
    require_admin_auth(request)
    try:
        from price_manager import remove_brand_discount
        if remove_brand_discount(brand):
            return {"status": "success", "message": f"Скидка для бренда {brand} удалена"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except Exception as e:
        logger.error(f"Ошибка при удалении скидки для бренда: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/prices/custom-price")
async def set_custom_price(request: Request, custom_price_request: CustomPriceRequest):
    """Устанавливает кастомную цену для модели"""
    require_admin_auth(request)
    try:
        from price_manager import set_custom_price
        if set_custom_price(custom_price_request.model, custom_price_request.price):
            return {"status": "success", "message": f"Кастомная цена для модели {custom_price_request.model} установлена: {custom_price_request.price} ₸"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ошибка при установке кастомной цены: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/prices/custom-price/{model}")
async def remove_custom_price(request: Request, model: str):
    """Удаляет кастомную цену для модели"""
    require_admin_auth(request)
    try:
        from price_manager import remove_custom_price
        if remove_custom_price(model):
            return {"status": "success", "message": f"Кастомная цена для модели {model} удалена"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось сохранить настройки")
    except Exception as e:
        logger.error(f"Ошибка при удалении кастомной цены: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/portal-mismatch")
async def get_portal_mismatch(request: Request, cached_data: dict = Depends(get_cached_data)):
    """Проверка битых/недостающих позиций"""
    require_admin_auth(request)
    """
    Проверка битых/недостающих позиций: товары из B2B, для которых нет папки в portal_export.
    Возвращает список позиций без папки и ожидаемое имя папки (model_to_foldername).
    """
    require_admin_auth(request)
    missing = []
    products = cached_data.get("products", [])
    for p in products:
        model = (p.get("model") or "").strip()
        if not model:
            continue
        folder = _portal_folder_for_model(model)
        if folder is None:
            missing.append({
                "model": model,
                "name": (p.get("name") or "").strip() or "—",
                "brand": (p.get("brand") or "").strip() or "—",
                "expected_folder": model_to_foldername(model),
                "clean_id": get_clean_id(model),
            })
    return {
        "total_products": len(products),
        "missing_count": len(missing),
        "missing": missing,
    }


@app.get("/api/parse-images/status")
async def get_image_parser_status(request: Request):
    """Возвращает статус парсера изображений"""
    require_admin_auth(request)
    """Возвращает статус парсера изображений"""
    return {
        "enabled": IMAGE_PARSER_ENABLED,
        "running": image_parser_state.get("running", False),
        "last_run": image_parser_state.get("last_run"),
        "max_pages": IMAGE_PARSER_MAX_PAGES if IMAGE_PARSER_MAX_PAGES > 0 else "все",
        "startup_delay": IMAGE_PARSER_STARTUP_DELAY
    }


@app.get("/api/portal-parser/status")
async def get_portal_parser_status(request: Request):
    """Статус парсера портала"""
    require_admin_auth(request)
    """Статус парсера портала: работает ли, время старта."""
    running = len(_portal_parser_tasks) > 0
    started_at = None
    if _portal_parser_started_at:
        from datetime import datetime
        started_at = datetime.fromtimestamp(_portal_parser_started_at).isoformat()
    return {
        "running": running,
        "tasks_count": len(_portal_parser_tasks),
        "started_at": started_at,
    }


@app.get("/api/portal-parser/logs")
async def get_portal_parser_logs(request: Request, limit: int = 300):
    """Последние строки лога парсера портала"""
    require_admin_auth(request)
    """Последние строки лога парсера портала."""
    n = min(max(1, limit), 500)
    lines = list(_portal_parser_log_buffer[-n:])
    return {"lines": lines, "total": len(_portal_parser_log_buffer)}


@app.post("/api/portal-parser/stop")
async def stop_portal_parser(request: Request):
    """Останавливает все запущенные задачи парсера портала"""
    require_admin_auth(request)
    """Останавливает все запущенные задачи парсера портала."""
    tasks = list(_portal_parser_tasks)
    if not tasks:
        return {"status": "ok", "message": "Парсер не запущен"}
    for task in tasks:
        task.cancel()
    return {"status": "success", "message": f"Остановка {len(tasks)} задач парсера"}


@app.post("/api/portal-parser/start-missing")
async def start_portal_parser_missing(request: Request, cached_data: dict = Depends(get_cached_data)):
    """Запускает парсер для недостающих папок"""
    require_admin_auth(request)
    """
    Запускает парсер только для товаров без папки в portal_export.
    Парсер ищет эти наименования в каталоге портала и создаёт папки.
    """
    missing = []
    for p in cached_data.get("products", []):
        model = (p.get("model") or "").strip()
        if not model:
            continue
        if _portal_folder_for_model(model) is None:
            missing.append({"expected_folder": model_to_foldername(model)})
    if not missing:
        return {"status": "ok", "message": "Нет недостающих папок", "count": 0}
    try:
        from portal_full_parser_browser import sanitize_foldername
        only_folders = {sanitize_foldername(m["expected_folder"]) for m in missing}
        success = await run_portal_parser_cannon(1, 0, only_expected_folders=only_folders)  # 0 = авто-определение
        if success:
            return {
                "status": "success",
                "message": f"Парсер запущен для {len(only_folders)} недостающих папок",
                "count": len(only_folders),
            }
        raise HTTPException(status_code=500, detail="Не удалось запустить парсер")
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Ошибка импорта: {e}")


@app.post("/api/portal-parser/start")
async def start_portal_parser(request: Request, start_page: Optional[int] = 1, end_page: Optional[int] = 0):
    """Запускает portal_parser_cannon.py (end_page=0 означает авто-определение из пагинации)"""
    require_admin_auth(request)
    try:
        success = await run_portal_parser_cannon(start_page or 1, end_page if end_page is not None else 0)
        if success:
            ep_msg = "авто" if (end_page == 0 or end_page is None) else str(end_page)
            return {
                "status": "success",
                "message": f"Парсер portal_parser_cannon запущен (страницы {start_page or 1}-{ep_msg})"
            }
        else:
            raise HTTPException(status_code=500, detail="Не удалось запустить парсер")
    except Exception as e:
        logger.error(f"Ошибка запуска portal_parser_cannon: {e}")
        raise HTTPException(status_code=500, detail=str(e))




# ---------------------------------------------------------------------------
# Enrichment — обогащение product.json из complex.com.kz
# ---------------------------------------------------------------------------
_enrichment_task: Optional[asyncio.Task] = None
_enrichment_started_at: Optional[float] = None
_enrichment_log_buffer: list = []
_ENRICHMENT_LOG_MAX = 500
_enrichment_stats: dict = {"enriched": 0, "failed": 0, "total": 0, "done": False}


class _EnrichmentLogHandler(logging.Handler):
    """Пишет логи обогащения в буфер для просмотра в админке."""
    def emit(self, record):
        try:
            msg = self.format(record)
            _enrichment_log_buffer.append(msg)
            while len(_enrichment_log_buffer) > _ENRICHMENT_LOG_MAX:
                _enrichment_log_buffer.pop(0)
        except Exception:
            pass


async def _run_enrichment(force: bool = False):
    """Запускает обогащение в фоне."""
    global _enrichment_started_at, _enrichment_stats
    _enrichment_started_at = time.time()
    _enrichment_stats = {"enriched": 0, "failed": 0, "total": 0, "done": False}
    enrich_logger = logging.getLogger("enrich_products")
    handler = _EnrichmentLogHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M:%S"))
    enrich_logger.addHandler(handler)
    enrich_logger.setLevel(logging.INFO)
    try:
        from enrich_products import collect_targets, run as run_enrichment
        targets = collect_targets(force)
        _enrichment_stats["total"] = len(targets)
        enrich_logger.info(f"Найдено {len(targets)} товаров для обогащения")
        if not targets:
            _enrichment_stats["done"] = True
            return
        stats = await run_enrichment(targets, log=enrich_logger)
        _enrichment_stats["enriched"] = stats.get("enriched", 0)
        _enrichment_stats["failed"] = stats.get("failed", 0)
        _enrichment_stats["done"] = True
        enrich_logger.info(
            f"Готово: обогащено {stats['enriched']}, ошибок {stats['failed']}"
        )
    except asyncio.CancelledError:
        enrich_logger.info("Обогащение отменено пользователем")
        _enrichment_stats["done"] = True
    except Exception as e:
        enrich_logger.error(f"Ошибка обогащения: {e}")
        _enrichment_stats["done"] = True
    finally:
        _enrichment_started_at = None
        enrich_logger.removeHandler(handler)


def _enrichment_done_callback(task):
    global _enrichment_task
    _enrichment_task = None


@app.post("/api/enrichment/start")
async def start_enrichment(request: Request, force: bool = False):
    """Запускает обогащение product.json из complex.com.kz"""
    require_admin_auth(request)
    global _enrichment_task
    if _enrichment_task and not _enrichment_task.done():
        raise HTTPException(status_code=409, detail="Обогащение уже запущено")
    _enrichment_log_buffer.clear()
    _enrichment_task = asyncio.create_task(_run_enrichment(force))
    _enrichment_task.add_done_callback(_enrichment_done_callback)
    return {"status": "success", "message": "Обогащение запущено"}


@app.post("/api/enrichment/stop")
async def stop_enrichment(request: Request):
    """Останавливает обогащение"""
    require_admin_auth(request)
    global _enrichment_task
    if not _enrichment_task or _enrichment_task.done():
        return {"status": "ok", "message": "Обогащение не запущено"}
    _enrichment_task.cancel()
    return {"status": "success", "message": "Обогащение останавливается"}


@app.get("/api/enrichment/status")
async def get_enrichment_status(request: Request):
    """Статус обогащения"""
    require_admin_auth(request)
    running = _enrichment_task is not None and not _enrichment_task.done()
    started_at = None
    if _enrichment_started_at:
        from datetime import datetime
        started_at = datetime.fromtimestamp(_enrichment_started_at).isoformat()
    return {
        "running": running,
        "started_at": started_at,
        **_enrichment_stats,
    }


@app.get("/api/enrichment/logs")
async def get_enrichment_logs(request: Request, limit: int = 300):
    """Последние строки лога обогащения"""
    require_admin_auth(request)
    n = min(max(1, limit), 500)
    lines = list(_enrichment_log_buffer[-n:])
    return {"lines": lines, "total": len(_enrichment_log_buffer)}


def _build_assistant_system_prompt(products: list, budget: Optional[float] = None, preferred_brands: Optional[list[str]] = None) -> str:
    """Строит системный промпт для ИИ-помощника с контекстом каталога"""
    # #region agent log
    _debug_log("main.py:_build_assistant_system_prompt", "entry", {"products_count": len(products)}, "C")
    # #endregion
    # Ограничиваем количество товаров для промпта (первые 500 или по категориям)
    products_sample = products[:500] if len(products) > 500 else products
    
    # Формируем краткий список товаров
    products_list = []
    for p in products_sample:
        model = (p.get("model") or "").strip()
        name = (p.get("name") or "").strip()
        brand = (p.get("brand") or "").strip()
        raw_price = p.get("final_price", p.get("price_rrc", 0))
        try:
            price_val = float(raw_price) if raw_price is not None else 0.0
        except (TypeError, ValueError):
            price_val = 0.0
        category = (p.get("category") or "").strip()
        if model:
            products_list.append(f"- {model} | {name} | {brand} | {price_val:.0f} ₸ | {category}")
    
    products_text = "\n".join(products_list[:300])  # Максимум 300 товаров в промпте
    
    try:
        budget_val = float(budget) if budget is not None else None
    except (TypeError, ValueError):
        budget_val = None
    budget_text = f"\n\nБюджет пользователя: {budget_val:.0f} ₸" if budget_val is not None else ""
    brands_text = f"\nПредпочтительные бренды: {', '.join(preferred_brands)}" if preferred_brands else ""
    
    prompt = f"""Ты умный помощник сайта G&R Group. Твои задачи:

1. **Навигатор по сайту**: помогай пользователям находить разделы:
   - Услуги (/services) — описание услуг компании
   - Проекты (/projects) — реализованные проекты
   - Контакты (/contacts) — контактная информация

2. **Консультант по каталогу комплектующих**: используй актуальный каталог товаров ниже для подбора решений.

**Каталог товаров** (модель | название | бренд | цена | категория):
{products_text}

**Правила подбора**:
- Подбирай товары по задаче пользователя (что нужно сделать)
{budget_text}
{brands_text}
- Если пользователь не знает, что нужно — уточни задачу и предложи типовые решения из каталога
- Если пользователь просит конкретную модель или тип товара — найди подходящие товары из каталога
- Если пользователь просит "добавить в корзину" или "собрать комплект" — перечисли модели для добавления

**Формат ответа**:
- Отвечай на русском языке, дружелюбно и профессионально
- В конце ответа, если рекомендуешь конкретные товары, добавь строку: PRODUCTS: model1, model2, model3
- Если товары не требуются, не добавляй PRODUCTS

**Примеры**:
- "Нужна камера для улицы" → предложи подходящие модели из каталога + PRODUCTS: DH-IPC-HFW..., IPC-...
- "Где услуги?" → "Раздел «Услуги» содержит информацию о наших услугах. Перейдите: /services"
- "Бюджет 50000, нужна система видеонаблюдения" → подбери товары в рамках бюджета + PRODUCTS: ..."""
    
    return prompt


async def _call_openai_api(prompt: str, user_message: str) -> str:
    """Вызывает OpenAI API (api.openai.com) для получения ответа от LLM"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API ключ не настроен (OPENAI_API_KEY)")
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.7,
        "max_tokens": 1000,
    }
    try:
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(url, json=payload, headers=headers, timeout=30),
        )
        response.raise_for_status()
        data = response.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
    except requests.exceptions.RequestException as e:
        logger.error(f"Ошибка вызова OpenAI API: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка OpenAI API: {str(e)}")
    except Exception as e:
        logger.error(f"Ошибка обработки ответа OpenAI: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обработки ответа LLM")


async def _call_openrouter_api(prompt: str, user_message: str) -> str:
    """Вызывает OpenRouter API для получения ответа от LLM"""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="LLM API ключ не настроен (OPENROUTER_API_KEY)")
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://grgroup.kz",
        "X-Title": "G&R Group Assistant",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.7,
        "max_tokens": 1000,
    }
    try:
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(url, json=payload, headers=headers, timeout=30),
        )
        response.raise_for_status()
        data = response.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
    except requests.exceptions.RequestException as e:
        logger.error(f"Ошибка вызова OpenRouter API: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка LLM API: {str(e)}")
    except Exception as e:
        logger.error(f"Ошибка обработки ответа OpenRouter: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обработки ответа LLM")


async def _call_llm(prompt: str, user_message: str) -> str:
    """Вызов LLM: приоритет у OpenAI, иначе OpenRouter."""
    if OPENAI_API_KEY:
        return await _call_openai_api(prompt, user_message)
    if OPENROUTER_API_KEY:
        return await _call_openrouter_api(prompt, user_message)
    raise HTTPException(status_code=500, detail="Не задан ни OPENAI_API_KEY, ни OPENROUTER_API_KEY в .env")


def _extract_product_models(text: str) -> list[str]:
    """Извлекает модели товаров из ответа ИИ (формат PRODUCTS: model1, model2, ...)"""
    products_match = re.search(r'PRODUCTS:\s*([^\n]+)', text, re.IGNORECASE)
    if not products_match:
        return []
    
    models_str = products_match.group(1).strip()
    models = [m.strip() for m in models_str.split(',') if m.strip()]
    return models


@app.post("/api/assistant/chat", response_model=AssistantChatResponse)
async def assistant_chat(
    request: AssistantChatRequest,
    cached_data: dict = Depends(get_cached_data)
):
    """
    Эндпоинт для общения с ИИ-помощником.
    Подбирает товары по задаче, бюджету и брендам из каталога.
    """
    # #region agent log
    _debug_log("main.py:assistant_chat", "entry", {"message_len": len(request.message or "")}, "B")
    # #endregion
    try:
        products = cached_data.get("products", [])
        # #region agent log
        _debug_log("main.py:assistant_chat", "after cached_data", {"products_count": len(products)}, "B")
        # #endregion
        
        # Фильтруем товары по предпочтительным брендам, если указаны
        filtered_products = products
        if request.brands:
            filtered_products = [
                p for p in products
                if (p.get("brand") or "").strip().lower() in [b.lower() for b in request.brands]
            ]
            # Если ничего не найдено по брендам, используем все товары
            if not filtered_products:
                filtered_products = products
        
        # Строим системный промпт с каталогом
        system_prompt = _build_assistant_system_prompt(
            filtered_products,
            budget=request.budget,
            preferred_brands=request.brands
        )
        # #region agent log
        _debug_log("main.py:assistant_chat", "after build_prompt", {"prompt_len": len(system_prompt)}, "C")
        # #endregion
        
        # Формируем сообщение пользователя с контекстом корзины
        user_message = request.message
        if request.cart:
            user_message += f"\n\nТекущая корзина: {', '.join(request.cart)}"
        
        # Вызываем LLM
        # #region agent log
        _debug_log("main.py:assistant_chat", "before _call_llm", {}, "D")
        # #endregion
        llm_response = await _call_llm(system_prompt, user_message)
        # #region agent log
        _debug_log("main.py:assistant_chat", "after _call_llm", {"response_len": len(llm_response or "")}, "E")
        # #endregion
        
        # Извлекаем модели товаров из ответа
        llm_text = llm_response if isinstance(llm_response, str) else (llm_response or "")
        product_models = _extract_product_models(llm_text)
        
        # Убираем маркер PRODUCTS из текста ответа
        text = re.sub(r'\n?PRODUCTS:\s*[^\n]+', '', llm_text, flags=re.IGNORECASE).strip()
        
        return AssistantChatResponse(
            text=text,
            product_models=product_models
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # #region agent log
        _debug_log("main.py:assistant_chat", "Exception", {"error": str(e), "type": type(e).__name__}, "F")
        # #endregion
        logger.error(f"Ошибка в assistant_chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка обработки запроса: {str(e)}")


@app.get("/api/products/{model:path}/detail")
async def get_product_detail(
    model: str,
    cached_data: dict = Depends(get_cached_data),
):
    """
    Детальная карточка товара: данные B2B + описание, характеристики и фото из portal_export.
    """
    from urllib.parse import unquote, quote
    model_decoded = unquote(model)
    product_data = _find_product_by_model(cached_data.get("products", []), model_decoded)
    if not product_data:
        raise HTTPException(status_code=404, detail="Товар не найден")
    canonical_model = product_data.get("model", model_decoded)
    model_enc = quote(canonical_model, safe="")
    base_url = f"/api/products/{model_enc}"
    result = {
        "name": product_data.get("name", ""),
        "model": product_data.get("model", ""),
        "brand": product_data.get("brand", ""),
        "quantity": product_data.get("quantity", 0),
        "description": "",
        "attributes": {},
        "images": [],
        "price_rrc": product_data.get("price_rrc") or product_data.get("price_client") or 0,
        "product_url": None,
    }
    from price_manager import calculate_final_price
    try:
        price_rrc = float(result["price_rrc"] or 0)
        info = calculate_final_price(price_rrc, result["model"], result["brand"])
        result["final_price"] = info["final_price"]
        result["discount"] = info["discount"]
        result["discount_amount"] = info["discount_amount"]
    except Exception:
        result["final_price"] = result["price_rrc"]
        result["discount"] = 0
        result["discount_amount"] = 0
    # Поиск папки: оба формата (_ и -) и clean_id
    portal_dir = _portal_folder_for_model(canonical_model)
    if portal_dir:
        product_json = portal_dir / "product.json"
        if product_json.exists():
            try:
                data = json.loads(product_json.read_text(encoding="utf-8"))
                result["description"] = data.get("description", "") or ""
                result["attributes"] = data.get("attributes") or {}
                result["product_url"] = data.get("product_url")
            except Exception:
                pass
        image_files = sorted(portal_dir.glob("image_*.*"))
        if image_files:
            result["images"] = [f"{base_url}/image?index={i}" for i in range(len(image_files))]
    if not result["images"]:
        result["images"] = [f"{base_url}/image"]
    return result


@app.get("/api/products/{model:path}/image")
async def get_product_image(
    model: str,
    index: Optional[int] = None,
    cached_data: dict = Depends(get_cached_data)
):
    """
    Получает изображение товара (index=0,1,2... — номер картинки из portal_export).
    Приоритет: portal_export → public/akuvox → images/ → сайт → placeholder.
    Товар может отсутствовать в каталоге (например, из корзины smart-systems) — тогда ищем только по model.
    """
    from urllib.parse import unquote

    model_decoded = unquote(model)
    image_index = index if index is not None and index >= 0 else 0
    products = cached_data.get("products", [])
    product = _find_product_by_model(products, model_decoded)
    model = product.get("model", model_decoded) if product else model_decoded
    brand = (product.get("brand") or "") if product else ""
    
    # 1. portal_export: по model_to_foldername и по clean_id
    portal_dir = _portal_folder_for_model(model)
    if portal_dir:
        image_files = sorted(portal_dir.glob("image_*.*"))
        if image_files and image_index < len(image_files):
            image_file = image_files[image_index]
            try:
                content_type_map = {
                    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                    ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
                }
                content_type = content_type_map.get(image_file.suffix.lower(), "image/jpeg")
                safe = model_decoded.encode("ascii", "ignore").decode("ascii") or "product"
                logger.info("Используется изображение из portal_export для %s: %s", model, image_file.name)
                return FileResponse(
                    path=str(image_file),
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=3600",
                        "Content-Disposition": f'inline; filename="{safe}{image_file.suffix}"',
                    },
                )
            except Exception as e:
                logger.warning("Ошибка чтения portal_export изображения %s: %s", image_file, e)

    # 1.5. Папка public/akuvox в корне проекта (для checkout и Akuvox-товаров)
    if _PUBLIC_AKUVOX_DIR.exists() and _PUBLIC_AKUVOX_DIR.is_dir():
        model_variants_akuvox = _folder_candidates_for_model(model) + [model.replace("/", "_"), model.replace("/", "-"), model]
        for variant in model_variants_akuvox:
            if not variant:
                continue
            # Файл по имени модели: MODEL.jpg, MODEL.png и т.д.
            for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                candidate = _PUBLIC_AKUVOX_DIR / f"{variant}{ext}"
                if candidate.is_file():
                    try:
                        content_type_map = {
                            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                            ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
                        }
                        content_type = content_type_map.get(ext.lower(), "image/jpeg")
                        safe = model_decoded.encode("ascii", "ignore").decode("ascii") or "product"
                        return FileResponse(
                            path=str(candidate),
                            media_type=content_type,
                            headers={
                                "Cache-Control": "public, max-age=3600",
                                "Content-Disposition": f'inline; filename="{safe}{ext}"',
                            },
                        )
                    except Exception as e:
                        logger.warning("Ошибка чтения public/akuvox изображения %s: %s", candidate, e)
                    break
            # Подпапка по модели с image_* или любым изображением
            subdir = _PUBLIC_AKUVOX_DIR / variant
            if subdir.is_dir():
                image_files = sorted(subdir.glob("image_*.*")) or list(subdir.glob("*.*"))
                image_files = [f for f in image_files if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif")]
                if image_files and image_index < len(image_files):
                    image_file = image_files[image_index]
                    try:
                        content_type_map = {
                            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                            ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
                        }
                        content_type = content_type_map.get(image_file.suffix.lower(), "image/jpeg")
                        safe = model_decoded.encode("ascii", "ignore").decode("ascii") or "product"
                        return FileResponse(
                            path=str(image_file),
                            media_type=content_type,
                            headers={
                                "Cache-Control": "public, max-age=3600",
                                "Content-Disposition": f'inline; filename="{safe}{image_file.suffix}"',
                            },
                        )
                    except Exception as e:
                        logger.warning("Ошибка чтения public/akuvox подпапки %s: %s", image_file, e)

    # 2. Локальные изображения из парсера (images/{model}/)
    model_variants = [model_to_foldername(model), model.replace("/", "_"), model.replace("/", "-"), model]
    images_dir = None
    for model_variant in model_variants:
        test_dir = Path(__file__).parent / "images" / model_variant
        if test_dir.exists() and test_dir.is_dir():
            images_dir = test_dir
            model = model_variant
            break
    if images_dir is None:
        images_dir = Path(__file__).parent / "images" / model

    if images_dir.exists() and images_dir.is_dir():
        # Ищем первое доступное изображение
        image_files = list(images_dir.glob("*.*"))
        if image_files:
            image_file = image_files[0]  # Берем первое изображение
            try:
                content_type_map = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp',
                    '.gif': 'image/gif'
                }
                ext = image_file.suffix.lower()
                content_type = content_type_map.get(ext, 'image/jpeg')
                
                safe_filename = model_decoded.encode('ascii', 'ignore').decode('ascii') or 'product'
                if not safe_filename or len(safe_filename) < 2:
                    safe_filename = 'product'
                
                logger.info(f"✓ Используется локальное изображение для {model}: {image_file.name}")
                return FileResponse(
                    path=str(image_file),
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=3600",
                        "Content-Disposition": f'inline; filename="{safe_filename}{ext}"'
                    }
                )
            except Exception as e:
                logger.warning(f"Ошибка чтения локального изображения {image_file}: {e}")
    
    # 2. Пробуем получить оригинальное изображение с сайта через парсер
    from product_image_parser import normalize_image_url
    from config import B2B_API_BASE_URL
    
    # Генерируем варианты URL из кэша и нормализуем их к оригиналу
    cache_urls = [
        f"{B2B_API_BASE_URL}/image/cache/catalog/{model}_1-360x360.jpg",
        f"{B2B_API_BASE_URL}/image/cache/catalog/{model}_1.jpg",
        f"{B2B_API_BASE_URL}/image/cache/catalog/{model}-360x360.jpg",
        f"{B2B_API_BASE_URL}/image/cache/catalog/{model}.jpg",
    ]
    
    # Нормализуем URL к оригиналу и пробуем загрузить
    for cache_url in cache_urls:
        original_url = normalize_image_url(cache_url)
        if not original_url:
            continue
        
        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda url=original_url: requests.head(url, timeout=5, allow_redirects=True)
            )
            
            if response.status_code == 200:
                # Загружаем полное изображение
                response = await loop.run_in_executor(
                    None,
                    lambda url=original_url: requests.get(url, timeout=10, stream=True, allow_redirects=True)
                )
                
                if response.status_code == 200:
                    content_type = response.headers.get('Content-Type', 'image/jpeg')
                    safe_filename = model_decoded.encode('ascii', 'ignore').decode('ascii') or 'product'
                    if not safe_filename or len(safe_filename) < 2:
                        safe_filename = 'product'
                    ext = content_type.split("/")[-1].split(';')[0]
                    
                    logger.info(f"✓ Найдено оригинальное изображение для {model}: {original_url}")
                    return Response(
                        content=response.content,
                        media_type=content_type,
                        headers={
                            "Cache-Control": "public, max-age=3600",
                            "Content-Disposition": f'inline; filename="{safe_filename}.{ext}"'
                        }
                    )
        except Exception as e:
            logger.debug(f"Не удалось загрузить оригинальное изображение {original_url}: {e}")
            continue
    
    # 3. Fallback: генерируем placeholder изображение локально
    logger.debug(f"Генерируется placeholder изображение для {model}")
    from placeholder_generator import generate_placeholder_image
    placeholder_text = f"{brand} {model}"[:40]
    placeholder_image = generate_placeholder_image(placeholder_text)
    
    safe_filename = model_decoded.encode('ascii', 'ignore').decode('ascii') or 'product'
    if not safe_filename or len(safe_filename) < 2:
        safe_filename = 'product'
    
    return Response(
        content=placeholder_image,
        media_type='image/png',
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": f'inline; filename="{safe_filename}.png"'
        }
    )


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """
    SPA fallback для React Router:
    - legacy HTML пути не обслуживаются;
    - существующие файлы из react/dist отдаются как есть;
    - остальное отдаётся index.html.
    - Поддерживает запросы с префиксом /catalog/ (для production через Nginx)
    """
    if full_path in {"index.html", "checkout.html", "admin.html"}:
        raise HTTPException(status_code=404, detail="Legacy HTML route is removed")

    # Если запрос начинается с /catalog/, убираем этот префикс
    # Это позволяет работать как с dev сборкой (без префикса), так и с production (с префиксом через Nginx)
    if full_path.startswith("catalog/"):
        full_path = full_path[8:]  # Убираем "catalog/" (8 символов)
    elif full_path.startswith("/catalog/"):
        full_path = full_path[9:]  # Убираем "/catalog/" (9 символов)

    requested_path = (react_dist_dir / full_path).resolve()
    dist_root = react_dist_dir.resolve()

    # Защита от выхода за пределы dist через path traversal.
    if not str(requested_path).startswith(str(dist_root)):
        raise HTTPException(status_code=404, detail="Not found")

    if requested_path.exists() and requested_path.is_file():
        return FileResponse(requested_path)

    # Если запрошен файл с расширением (например .js/.css), но его нет — 404.
    if "." in Path(full_path).name:
        raise HTTPException(status_code=404, detail="File not found")

    if react_index_file.exists() or await _ensure_react_build_async():
        return FileResponse(react_index_file)
    return _react_build_missing_response()


if __name__ == "__main__":
    import uvicorn
    from config import HOST, PORT, UVICORN_WORKERS

    workers = UVICORN_WORKERS if UVICORN_WORKERS > 1 else 1
    use_reload = workers <= 1

    if use_reload:
        # reload требует строку "module:app", не объект
        uvicorn.run(
            "main:app",
            host=HOST,
            port=PORT,
            reload=True,
        )
    else:
        uvicorn.run(
            app,
            host=HOST,
            port=PORT,
            workers=workers,
        )
