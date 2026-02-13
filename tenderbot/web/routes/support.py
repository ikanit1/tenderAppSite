# web/routes/support.py — тикеты поддержки в веб-админке
import uuid
import httpx
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Request, Depends, File, Query, Form, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from config import settings
from web.database import get_db
from web.auth import require_admin
from web.templates_loader import templates
from database.models import User, SupportTicket, SupportMessage, TicketStatus

router = APIRouter()

_UPLOADS_SUPPORT = Path(__file__).resolve().parent.parent / "static" / "uploads" / "support"
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def _save_support_image(file: UploadFile) -> str | None:
    if not file.content_type or file.content_type.lower() not in _ALLOWED_IMAGE_TYPES:
        return None
    ext = ".jpg" if "jpeg" in file.content_type else ".png" if "png" in file.content_type else ".gif" if "gif" in file.content_type else ".webp"
    _UPLOADS_SUPPORT.mkdir(parents=True, exist_ok=True)
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


@router.get("", response_class=HTMLResponse)
async def support_list(
    request: Request,
    db: Session = Depends(get_db),
    status: str | None = Query(None),
):
    """Список тикетов: новые (красные), в процессе (жёлтые), закрытые (архив)."""
    if redir := require_admin(request):
        return redir

    q = (
        select(SupportTicket)
        .options(selectinload(SupportTicket.user), selectinload(SupportTicket.messages))
        .order_by(SupportTicket.id.desc())
    )
    if status and status in ("new", "in_progress", "closed"):
        q = q.where(SupportTicket.status == status)
    tickets = db.execute(q).scalars().all()

    # Extract last message from eagerly-loaded messages (no N+1)
    last_msgs = {}
    for t in tickets:
        if t.messages:
            last_msg = max(t.messages, key=lambda m: m.created_at or datetime.min)
            last_msgs[t.id] = (last_msg.text, last_msg.created_at)
        else:
            last_msgs[t.id] = None

    return templates.TemplateResponse(
        "support.html",
        {
            "request": request,
            "tickets": tickets,
            "last_msgs": last_msgs,
            "status_filter": status,
            "statuses": [
                ("new", "Новые"),
                ("in_progress", "В процессе"),
                ("closed", "Закрытые"),
            ],
        },
    )


@router.get("/{ticket_id}", response_class=HTMLResponse)
async def support_chat(
    request: Request,
    ticket_id: int,
    db: Session = Depends(get_db),
):
    """Страница чата с пользователем по тикету."""
    if redir := require_admin(request):
        return redir

    ticket = (
        db.execute(
            select(SupportTicket)
            .options(
                selectinload(SupportTicket.user),
                selectinload(SupportTicket.messages),
            )
            .where(SupportTicket.id == ticket_id)
        )
    ).scalar_one_or_none()
    if not ticket:
        return RedirectResponse(url="/support", status_code=302)

    messages = sorted(ticket.messages, key=lambda m: m.created_at or 0)
    return templates.TemplateResponse(
        "support_chat.html",
        {
            "request": request,
            "ticket": ticket,
            "messages": messages,
        },
    )


@router.post("/{ticket_id}/reply", response_class=RedirectResponse)
async def support_reply(
    request: Request,
    ticket_id: int,
    db: Session = Depends(get_db),
    text: str = Form(""),
    image: UploadFile | None = File(None),
):
    """Ответ админа: текст и/или изображение, отправка в Telegram пользователю."""
    if redir := require_admin(request):
        return redir

    ticket = (
        db.execute(
            select(SupportTicket).options(selectinload(SupportTicket.user)).where(SupportTicket.id == ticket_id)
        )
    ).scalar_one_or_none()
    if not ticket:
        return RedirectResponse(url="/support", status_code=302)

    text = (text or "").strip()
    image_url = None
    if image and image.filename:
        image_url = _save_support_image(image)
    if not text and not image_url:
        return RedirectResponse(url=f"/support/{ticket_id}", status_code=302)

    msg = SupportMessage(ticket_id=ticket_id, author="admin", text=text or "(изображение)", image_url=image_url)
    db.add(msg)
    ticket.status = TicketStatus.IN_PROGRESS.value
    db.commit()

    tg_id = ticket.user.tg_id
    base_url = str(request.base_url).rstrip("/")
    try:
        async with httpx.AsyncClient() as client:
            if image_url:
                photo_url = base_url + image_url
                r = await client.post(
                    f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendPhoto",
                    data={"chat_id": tg_id, "photo": photo_url, "caption": text[:1024] if text else None, "parse_mode": "HTML"},
                    timeout=15.0,
                )
            else:
                r = await client.post(
                    f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage",
                    json={"chat_id": tg_id, "text": text, "parse_mode": "HTML"},
                    timeout=10.0,
                )
    except Exception:
        pass

    return RedirectResponse(url=f"/support/{ticket_id}", status_code=302)


@router.post("/{ticket_id}/close", response_class=RedirectResponse)
async def support_close(
    request: Request,
    ticket_id: int,
    db: Session = Depends(get_db),
):
    """Закрыть тикет."""
    if redir := require_admin(request):
        return redir
    ticket = db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id)).scalar_one_or_none()
    if ticket:
        ticket.status = TicketStatus.CLOSED.value
        db.commit()
    return RedirectResponse(url="/support", status_code=302)


@router.post("/{ticket_id}/delete", response_class=RedirectResponse)
async def support_ticket_delete(
    request: Request,
    ticket_id: int,
    db: Session = Depends(get_db),
):
    """Удалить тикет и все сообщения (освободить место, не копить архив)."""
    if redir := require_admin(request):
        return redir
    ticket = db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id)).scalar_one_or_none()
    if ticket:
        db.delete(ticket)
        db.commit()
    return RedirectResponse(url="/support", status_code=302)


# Шаблоны быстрых ответов (опционально)
REPLY_TEMPLATES = [
    "Здравствуйте! Чем могу помочь?",
    "Ваш вопрос принят в работу.",
    "Пожалуйста, приложите скриншот или уточните детали.",
    "Спасибо за обращение. Тикет закрыт.",
]


@router.get("/api/templates", response_class=JSONResponse)
async def support_templates_api(request: Request):
    if redir := require_admin(request):
        return redir
    return JSONResponse({"templates": REPLY_TEMPLATES})


@router.get("/api/new_count", response_class=JSONResponse)
async def support_new_count(request: Request, db: Session = Depends(get_db)):
    """Количество тикетов со статусом «новый» — для уведомлений админа (polling + звук)."""
    if redir := require_admin(request):
        return redir
    r = db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.status == TicketStatus.NEW.value))
    n = r.scalar() or 0
    return JSONResponse({"count": n})
