# web/miniapp/routes.py — API для Telegram Mini App
import base64
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Body, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, func, cast, String
from sqlalchemy.orm import Session, selectinload

from config import settings
from web.database import get_db
from web.miniapp.auth import get_tg_id_from_init_data
from web.miniapp.notify import send_telegram_message
from database.models import (
    User,
    Tender,
    TenderApplication,
    Review,
    UserStatus,
    UserRole,
    TenderStatus,
    SupportTicket,
    SupportMessage,
    TicketStatus,
)

router = APIRouter(prefix="/miniapp", tags=["miniapp"])

# Загрузка изображений поддержки: web/static/uploads/support/
_UPLOADS_SUPPORT = Path(__file__).resolve().parent.parent / "static" / "uploads" / "support"
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def _save_support_image(file: UploadFile) -> Optional[str]:
    """Сохраняет загруженное изображение, возвращает URL пути."""
    _UPLOADS_SUPPORT.mkdir(parents=True, exist_ok=True)
    ct = (file.content_type or "").lower()
    if ct in _ALLOWED_IMAGE_TYPES:
        ext = ".jpg" if "jpeg" in ct else ".png" if "png" in ct else ".gif" if "gif" in ct else ".webp"
    else:
        # WebView может отдавать application/octet-stream — берём расширение из имени файла
        fn = (file.filename or "").lower()
        if fn.endswith(".png"): ext = ".png"
        elif fn.endswith(".gif"): ext = ".gif"
        elif fn.endswith(".webp"): ext = ".webp"
        else: ext = ".jpg"
    name = uuid.uuid4().hex + ext
    path = _UPLOADS_SUPPORT / name
    try:
        content = file.file.read()
        if len(content) > _MAX_IMAGE_SIZE:
            return None
        path.write_bytes(content)
        return f"/static/uploads/support/{name}"
    except Exception:
        return None


def _save_support_image_base64(data: str) -> Optional[str]:
    """Принимает data URL (data:image/...;base64,...) или сырой base64. Сохраняет файл, возвращает URL."""
    raw = data.strip()
    if raw.startswith("data:"):
        idx = raw.find("base64,")
        if idx == -1:
            return None
        raw = raw[idx + 7:]
    try:
        content = base64.b64decode(raw, validate=True)
    except Exception:
        return None
    if len(content) > _MAX_IMAGE_SIZE:
        return None
    ext = ".jpg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        ext = ".png"
    elif content[:6] in (b"GIF87a", b"GIF89a"):
        ext = ".gif"
    elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        ext = ".webp"
    _UPLOADS_SUPPORT.mkdir(parents=True, exist_ok=True)
    name = uuid.uuid4().hex + ext
    path = _UPLOADS_SUPPORT / name
    try:
        path.write_bytes(content)
        return f"/static/uploads/support/{name}"
    except Exception:
        return None


# Зависимость: initData из заголовка или query (на мобильном WebView заголовок может не передаваться)
def get_current_tg_id(
    x_telegram_init_data: Optional[str] = Header(None, alias="X-Telegram-Init-Data"),
    init_data: Optional[str] = Query(None, alias="init_data"),
) -> int:
    raw = (x_telegram_init_data or init_data or "").strip()
    if not raw:
        raise HTTPException(
            status_code=401,
            detail="init_data_missing",  # Откройте приложение из бота (кнопка меню), не в браузере
        )
    tg_id = get_tg_id_from_init_data(raw)
    if tg_id is None:
        raise HTTPException(
            status_code=401,
            detail="init_data_invalid",  # Сессия устарела или неверный источник — закройте и откройте приложение снова
        )
    return tg_id


def get_current_user(
    tg_id: int = Depends(get_current_tg_id),
    db: Session = Depends(get_db),
) -> User:
    result = db.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")  # Пройдите регистрацию в боте
    return user


def require_active(user: User = Depends(get_current_user)) -> User:
    if user.status == UserStatus.BANNED.value:
        raise HTTPException(status_code=403, detail="Account blocked")
    return user


# ——— Раздача главной страницы Mini App ———
_MINIAPP_STATIC = Path(__file__).parent.parent / "static" / "miniapp"
_NO_CACHE_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}


def _file_response(path: Path, media_type: str):
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type=media_type, headers=_NO_CACHE_HEADERS)


@router.get("/", response_class=FileResponse)
def miniapp_index():
    """Отдаёт index.html Mini App."""
    return _file_response(_MINIAPP_STATIC / "index.html", "text/html")


@router.get("/styles.css", response_class=FileResponse)
def miniapp_css():
    return _file_response(_MINIAPP_STATIC / "styles.css", "text/css")


@router.get("/app.js", response_class=FileResponse)
def miniapp_js():
    return _file_response(_MINIAPP_STATIC / "app.js", "application/javascript")


# ——— API: я (текущий пользователь) ———
@router.get("/api/me")
def api_me(
    user: User = Depends(get_current_user),
):
    """Текущий пользователь: есть ли в БД, статус, роль."""
    return {
        "id": user.id,
        "tg_id": user.tg_id,
        "full_name": user.full_name,
        "city": user.city,
        "phone": user.phone,
        "role": user.role,
        "status": user.status,
        "skills": user.skills or [],
        "birth_date": user.birth_date.isoformat() if user.birth_date else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


from web.utils.datetime_helpers import dt_or_min, parse_since


def _max_ts(values: list[Optional[datetime]]) -> datetime:
    return max((dt_or_min(v) for v in values), default=datetime.min.replace(tzinfo=timezone.utc))


def _scope_last_update(db: Session, user_id: int, scope: str, ticket_id: Optional[int]) -> datetime:
    if scope == "support_chat" and ticket_id:
        msg_ts = db.execute(
            select(func.max(SupportMessage.created_at))
            .join(SupportTicket, SupportTicket.id == SupportMessage.ticket_id)
            .where(SupportTicket.user_id == user_id, SupportTicket.id == ticket_id)
        ).scalar()
        return dt_or_min(msg_ts)
    if scope == "support":
        msg_ts = db.execute(
            select(func.max(SupportMessage.created_at))
            .join(SupportTicket, SupportTicket.id == SupportMessage.ticket_id)
            .where(SupportTicket.user_id == user_id)
        ).scalar()
        ticket_ts = db.execute(
            select(func.max(func.coalesce(SupportTicket.updated_at, SupportTicket.created_at)))
            .where(SupportTicket.user_id == user_id)
        ).scalar()
        return _max_ts([msg_ts, ticket_ts])
    if scope == "applications":
        app_ts = db.execute(
            select(func.max(func.coalesce(TenderApplication.updated_at, TenderApplication.created_at)))
            .where(TenderApplication.user_id == user_id)
        ).scalar()
        return dt_or_min(app_ts)
    if scope == "tenders":
        tender_ts = db.execute(
            select(func.max(func.coalesce(Tender.updated_at, Tender.created_at)))
        ).scalar()
        return dt_or_min(tender_ts)
    if scope == "home":
        tender_ts = db.execute(
            select(func.max(func.coalesce(Tender.updated_at, Tender.created_at)))
        ).scalar()
        app_ts = db.execute(
            select(func.max(func.coalesce(TenderApplication.updated_at, TenderApplication.created_at)))
            .where(TenderApplication.user_id == user_id)
        ).scalar()
        return _max_ts([tender_ts, app_ts])
    user_ts = db.execute(select(func.coalesce(User.updated_at, User.created_at)).where(User.id == user_id)).scalar()
    return dt_or_min(user_ts)


@router.get("/api/updates")
def api_updates(
    scope: str = Query("home"),
    since: Optional[str] = Query(None),
    timeout: int = Query(25, ge=1, le=60),
    ticket_id: Optional[int] = Query(None),
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Лонг-полл обновлений по экрану (возвращает changed и ts)."""
    since_dt = parse_since(since)
    started = time.time()
    while True:
        current_ts = _scope_last_update(db, user.id, scope, ticket_id)
        changed = bool(since_dt and current_ts > since_dt)
        if changed or (time.time() - started) >= timeout or since_dt is None:
            return {"changed": changed, "ts": current_ts.isoformat()}
        time.sleep(2)


# ——— API: профиль (GET/PATCH) ———
@router.get("/api/profile")
def api_profile_get(user: User = Depends(require_active)):
    return {
        "full_name": user.full_name,
        "city": user.city,
        "phone": user.phone,
        "skills": user.skills or [],
        "birth_date": user.birth_date.isoformat() if user.birth_date else None,
        "status": user.status,
        "role": user.role,
    }


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[list[str]] = None


@router.patch("/api/profile")
def api_profile_patch(
    body: ProfileUpdate = Body(default=ProfileUpdate()),
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    if body.full_name is not None:
        user.full_name = body.full_name.strip()[:256]
    if body.city is not None:
        city = body.city.strip()[:128]
        if city not in settings.CITIES:
            raise HTTPException(status_code=400, detail="Выберите город из списка")
        user.city = city
    if body.phone is not None:
        user.phone = body.phone.strip()[:64]
    if body.skills is not None:
        user.skills = [s for s in body.skills if s][:20] or None
    db.commit()
    return {"ok": True}


# ——— API: список тендеров (открытые, по городу пользователя) ———
@router.get("/api/tenders")
def api_tenders_list(
    city: Optional[str] = None,
    category: Optional[str] = None,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    q = (
        select(Tender)
        .where(Tender.status == TenderStatus.OPEN.value)
        .order_by(Tender.id.desc())
    )
    if city:
        q = q.where(Tender.city == city)
    else:
        q = q.where(Tender.city == user.city)
    if category:
        from sqlalchemy import cast, String
        q = q.where(cast(Tender.categories, String).contains(f'"{category}"'))
    q = q.limit(50)
    result = db.execute(q)
    tenders = result.scalars().all()
    # Проверяем, откликался ли текущий пользователь на каждый
    out = []
    for t in tenders:
        app_result = db.execute(
            select(TenderApplication.id).where(
                TenderApplication.tender_id == t.id,
                TenderApplication.user_id == user.id,
            )
        )
        has_applied = app_result.scalar_one_or_none() is not None
        deadline_str = None
        if t.deadline:
            d = t.deadline
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            deadline_str = d.isoformat()
        out.append({
            "id": t.id,
            "title": t.title,
            "city": t.city,
            "category": ", ".join(t.categories or []),
            "budget": t.budget,
            "description": t.description[:500] if t.description else "",
            "deadline": deadline_str,
            "status": t.status,
            "has_applied": has_applied,
        })
    return {"tenders": out}


# ——— API: один тендер ———
@router.get("/api/tenders/{tender_id}")
def api_tender_detail(
    tender_id: int,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Tender).where(Tender.id == tender_id)
    )
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    app_result = db.execute(
        select(TenderApplication).where(
            TenderApplication.tender_id == tender_id,
            TenderApplication.user_id == user.id,
        )
    )
    my_application = app_result.scalar_one_or_none()
    deadline_str = None
    if tender.deadline:
        d = tender.deadline
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        deadline_str = d.isoformat()
    return {
        "id": tender.id,
        "title": tender.title,
        "city": tender.city,
        "category": ", ".join(tender.categories or []),
        "budget": tender.budget,
        "description": tender.description,
        "deadline": deadline_str,
        "status": tender.status,
        "has_applied": my_application is not None,
        "application_id": my_application.id if my_application else None,
        "application_status": my_application.status if my_application else None,
    }


# ——— API: откликнуться на тендер ———
@router.post("/api/tenders/{tender_id}/apply")
def api_tender_apply(
  tender_id: int,
  user: User = Depends(require_active),
  db: Session = Depends(get_db),
):
    if user.role not in (UserRole.EXECUTOR.value, UserRole.BOTH.value):
        raise HTTPException(status_code=403, detail="Only executors can apply")
    result = db.execute(
        select(Tender)
        .options(selectinload(Tender.creator))
        .where(Tender.id == tender_id, Tender.status == TenderStatus.OPEN.value)
    )
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found or closed")
    if tender.deadline:
        deadline_utc = tender.deadline
        if deadline_utc.tzinfo is None:
            deadline_utc = deadline_utc.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > deadline_utc:
            raise HTTPException(status_code=400, detail="Deadline passed")
    existing = db.execute(
        select(TenderApplication).where(
            TenderApplication.tender_id == tender_id,
            TenderApplication.user_id == user.id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied")
    app = TenderApplication(
        tender_id=tender_id,
        user_id=user.id,
        status="applied",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    send_telegram_message(
        user.tg_id,
        f"✅ <b>Отклик принят</b>\n\n"
        f"Заказ: «{tender.title}». Ожидайте решения — статус обновится в приложении (раздел «Мои отклики»).",
    )
    skills_str = ", ".join(user.skills) if user.skills else "—"
    admin_text = (
        f"📩 <b>Новый отклик</b> · «{tender.title}»\n"
        f"Исполнитель: {user.full_name} · {user.city} · {user.phone}\n"
        f"Навыки: {skills_str}"
    )
    send_telegram_message(settings.ADMIN_ID, admin_text)
    if tender.creator and tender.creator.tg_id != settings.ADMIN_ID:
        send_telegram_message(tender.creator.tg_id, admin_text)
    return {"ok": True, "application_id": app.id}


# ——— API: мои отклики ———
@router.get("/api/applications")
def api_my_applications(
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(TenderApplication, Tender)
        .join(Tender, TenderApplication.tender_id == Tender.id)
        .where(TenderApplication.user_id == user.id)
        .order_by(TenderApplication.id.desc())
    )
    rows = result.all()
    out = []
    for app, tender in rows:
        deadline_str = None
        if tender.deadline:
            d = tender.deadline
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            deadline_str = d.isoformat()
        out.append({
            "id": app.id,
            "tender_id": tender.id,
            "tender_title": tender.title,
            "tender_city": tender.city,
            "tender_category": ", ".join(tender.categories or []),
            "tender_budget": tender.budget,
            "status": app.status,
            "created_at": app.created_at.isoformat() if app.created_at else None,
            "deadline": deadline_str,
        })
    return {"applications": out}


@router.get("/api/applications/{application_id}")
def api_application_detail(
    application_id: int,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(TenderApplication, Tender)
        .join(Tender, TenderApplication.tender_id == Tender.id)
        .where(
            TenderApplication.id == application_id,
            TenderApplication.user_id == user.id,
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    app, tender = row
    deadline_str = None
    if tender.deadline:
        d = tender.deadline
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        deadline_str = d.isoformat()
    return {
        "id": app.id,
        "tender_id": tender.id,
        "tender_title": tender.title,
        "tender_city": tender.city,
        "tender_category": tender.category,
        "tender_budget": tender.budget,
        "tender_description": tender.description,
        "status": app.status,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "deadline": deadline_str,
    }


# ——— API: навыки (категории) для выбора в профиле ———
@router.get("/api/skills")
def api_skills():
    return {"skills": settings.SKILL_TAGS}


@router.get("/api/cities")
def api_cities():
    return {"cities": settings.CITIES}


# ——— API: поддержка (тикеты и сообщения) ———
@router.get("/api/support/tickets")
def api_support_tickets(
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Список тикетов текущего пользователя."""
    result = db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.id.desc())
    )
    tickets = result.scalars().all()
    out = []
    for t in tickets:
        last = (
            db.execute(
                select(SupportMessage.text, SupportMessage.created_at)
                .where(SupportMessage.ticket_id == t.id)
                .order_by(SupportMessage.created_at.desc())
                .limit(1)
            )
        ).first()
        out.append({
            "id": t.id,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "last_preview": (last[0][:80] + "…") if last and last[0] and len(last[0]) > 80 else (last[0] if last else None),
        })
    return {"tickets": out}


@router.get("/api/support/tickets/{ticket_id}")
def api_support_ticket_detail(
    ticket_id: int,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Один тикет с сообщениями (только свой)."""
    result = db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id, SupportTicket.user_id == user.id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = sorted(ticket.messages or [], key=lambda m: m.created_at or datetime.min.replace(tzinfo=timezone.utc))
    return {
        "id": ticket.id,
        "status": ticket.status,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        "messages": [
            {
                "id": m.id,
                "author": m.author,
                "text": m.text,
                "image_url": m.image_url,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


class SupportMessageIn(BaseModel):
    text: Optional[str] = None
    image_base64: Optional[str] = None  # data URL или base64 — для Mini App WebView


@router.post("/api/support/tickets")
def api_support_create_ticket(
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
    body: Optional[SupportMessageIn] = Body(default=None),
):
    """Создать тикет (опционально с первым сообщением)."""
    # Открытый тикет уже есть — вернуть его
    existing = db.execute(
        select(SupportTicket)
        .where(
            SupportTicket.user_id == user.id,
            SupportTicket.status != TicketStatus.CLOSED.value,
        )
        .order_by(SupportTicket.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "created": False}
    ticket = SupportTicket(user_id=user.id, status=TicketStatus.NEW.value)
    db.add(ticket)
    db.flush()
    if body and (text := ((body.text or "").strip())):
        db.add(SupportMessage(ticket_id=ticket.id, author="user", text=text))
        ticket.status = TicketStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "created": True}


@router.post("/api/support/tickets/{ticket_id}/messages")
def api_support_send_message(
    ticket_id: int,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
    body: SupportMessageIn = Body(default=None),
):
    """Отправить сообщение в тикет (JSON: текст и/или image_base64 для WebView)."""
    if body is None:
        raise HTTPException(status_code=400, detail="Empty message")
    ticket = db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user.id,
        )
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == TicketStatus.CLOSED.value:
        raise HTTPException(status_code=400, detail="Ticket closed")
    text = (body.text or "").strip()
    image_url = None
    if body.image_base64:
        image_url = _save_support_image_base64(body.image_base64)
    if not text and not image_url:
        raise HTTPException(status_code=400, detail="Укажите текст или приложите изображение")
    msg = SupportMessage(ticket_id=ticket_id, author="user", text=text or "(изображение)", image_url=image_url)
    db.add(msg)
    if ticket.status == TicketStatus.NEW.value:
        ticket.status = TicketStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "author": msg.author,
        "text": msg.text,
        "image_url": msg.image_url,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.post("/api/support/tickets/{ticket_id}/messages/upload")
def api_support_send_message_upload(
    ticket_id: int,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
    text: str = Form(""),
    image: Optional[UploadFile] = File(None),
):
    """Отправить сообщение в тикет с опциональным изображением (multipart)."""
    ticket = db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user.id,
        )
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == TicketStatus.CLOSED.value:
        raise HTTPException(status_code=400, detail="Ticket closed")
    text = (text or "").strip()
    image_url = None
    if image and image.filename:
        image_url = _save_support_image(image)
    if not text and not image_url:
        raise HTTPException(status_code=400, detail="Укажите текст или приложите изображение")
    msg = SupportMessage(ticket_id=ticket_id, author="user", text=text or "(изображение)", image_url=image_url)
    db.add(msg)
    if ticket.status == TicketStatus.NEW.value:
        ticket.status = TicketStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "author": msg.author,
        "text": msg.text,
        "image_url": msg.image_url,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.post("/api/support/tickets/{ticket_id}/close")
def api_support_close_ticket(
    ticket_id: int,
    user: User = Depends(require_active),
    db: Session = Depends(get_db),
):
    """Закрыть тикет (только свой)."""
    ticket = db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == user.id,
        )
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = TicketStatus.CLOSED.value
    db.commit()
    return {"ok": True}
