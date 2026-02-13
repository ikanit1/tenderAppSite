# web/routes/users.py
import csv
import io
import logging
import urllib.request
import json

from fastapi import APIRouter, Request, Depends, Query, Form
from fastapi.responses import HTMLResponse, RedirectResponse, Response, StreamingResponse
from typing import Annotated
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from web.database import get_db
from web.auth import require_admin
from web.templates_loader import templates
from database.models import User, Review, UserStatus, UserRole
from utils.validators import validate_string_length

logger = logging.getLogger(__name__)

router = APIRouter()


def normalize_documents(documents) -> list:
    """Приводит user.documents к списку {type, file_id, file_name?, mime_type?}. Поддержка старого формата (dict)."""
    if not documents:
        return []
    if isinstance(documents, list):
        return documents
    # Legacy: {"photo_file_id": "...", "document_file_id": "...", "file_name": "...", "mime_type": "..."}
    out = []
    if documents.get("photo_file_id"):
        out.append({
            "type": "photo",
            "file_id": documents["photo_file_id"],
            "file_name": None,
            "mime_type": "image/jpeg",
        })
    if documents.get("document_file_id"):
        out.append({
            "type": "document",
            "file_id": documents["document_file_id"],
            "file_name": documents.get("file_name"),
            "mime_type": documents.get("mime_type"),
        })
    return out


@router.get("", response_class=HTMLResponse)
async def users_list(
    request: Request,
    db: Session = Depends(get_db),
    role: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
):
    if redir := require_admin(request):
        return redir

    from web.utils.pagination import get_page_info
    PER_PAGE = 20

    q = select(User).order_by(User.id.desc())
    if role:
        q = q.where(User.role == role)
    if status:
        q = q.where(User.status == status)

    # Count total
    count_q = select(func.count(User.id))
    if role:
        count_q = count_q.where(User.role == role)
    if status:
        count_q = count_q.where(User.status == status)
    total = db.execute(count_q).scalar() or 0

    page_info = get_page_info(page, PER_PAGE, total)
    users = db.execute(q.offset(page_info.offset).limit(page_info.per_page)).scalars().all()

    # Ratings for displayed users only (optimization)
    user_ids = [u.id for u in users]
    ratings = {}
    if user_ids:
        result = db.execute(
            select(Review.to_user_id, func.avg(Review.rating), func.count(Review.id))
            .where(Review.to_user_id.in_(user_ids))
            .group_by(Review.to_user_id)
        )
        ratings = {row[0]: (float(row[1]) if row[1] else 0, row[2]) for row in result.all()}

    return templates.TemplateResponse(
        "users.html",
        {"request": request, "users": users, "ratings": ratings, "page_info": page_info},
    )


@router.get("/by-tg/{tg_id}/document")
async def user_document_by_tg(
    request: Request,
    tg_id: int,
    index: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Прокси документа/фото по Telegram ID пользователя и индексу в списке. URL: /users/by-tg/947126451/document?index=0"""
    if redir := require_admin(request):
        return redir
    user = db.execute(select(User).where(User.tg_id == tg_id)).scalar_one_or_none()
    if not user:
        return Response(status_code=404)
    docs_list = normalize_documents(user.documents)
    if index >= len(docs_list):
        return Response(status_code=404)
    item = docs_list[index]
    file_id = item.get("file_id")
    if not file_id:
        return Response(status_code=404)
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/getFile?file_id={file_id}"
    try:
        with urllib.request.urlopen(url) as r:
            data = json.loads(r.read().decode())
        if not data.get("ok"):
            return Response(status_code=502)
        file_path = data["result"]["file_path"]
        file_url = f"https://api.telegram.org/file/bot{settings.BOT_TOKEN}/{file_path}"
        with urllib.request.urlopen(file_url) as f:
            content = f.read()
        doc_type = item.get("type") or "document"
        file_name = item.get("file_name")
        mime = item.get("mime_type") or ""
        if doc_type == "photo":
            media_type = "image/jpeg"
            filename = "photo.jpg"
        else:
            filename = file_name or "document"
            if mime.startswith("application/pdf") or (filename and filename.lower().endswith(".pdf")):
                media_type = "application/pdf"
            else:
                media_type = mime or "application/octet-stream"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    except Exception:
        return Response(status_code=502)


@router.get("/{user_id}/edit", response_class=HTMLResponse)
async def user_edit_form(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        return RedirectResponse(url="/users", status_code=302)
    return templates.TemplateResponse(
        "user_form.html",
        {
            "request": request,
            "user": user,
            "skill_tags": settings.SKILL_TAGS,
            "cities": settings.CITIES,
            "roles": [r.value for r in UserRole],
            "statuses": [s.value for s in UserStatus],
        },
    )


@router.post("/{user_id}/edit", response_class=RedirectResponse)
async def user_update(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
    full_name: Annotated[str, Form()] = None,
    city: Annotated[str, Form()] = None,
    phone: Annotated[str, Form()] = None,
    role: Annotated[str, Form()] = None,
    status: Annotated[str, Form()] = None,
    skills: Annotated[list[str] | None, Form()] = None,
):
    if redir := require_admin(request):
        return redir
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        return RedirectResponse(url="/users", status_code=302)
    
    try:
        if full_name is not None:
            is_valid, error_msg = validate_string_length(full_name.strip(), max_length=256, field_name="ФИО")
            if not is_valid:
                return RedirectResponse(url=f"/users/{user_id}?error={error_msg}", status_code=302)
            user.full_name = full_name.strip()
        if city is not None:
            city_val = city.strip()
            if city_val not in settings.CITIES:
                return RedirectResponse(url=f"/users/{user_id}?error=Выберите город из списка", status_code=302)
            user.city = city_val
        if phone is not None:
            is_valid, error_msg = validate_string_length(phone.strip(), max_length=64, field_name="Телефон")
            if not is_valid:
                return RedirectResponse(url=f"/users/{user_id}?error={error_msg}", status_code=302)
            user.phone = phone.strip()
        if role and role in [r.value for r in UserRole]:
            user.role = role
        if status and status in [s.value for s in UserStatus]:
            user.status = status
        if skills is not None:
            user.skills = [s for s in skills if s] or None
        db.commit()
        logger.info(f"User {user_id} updated via web interface")
        return RedirectResponse(url=f"/users/{user_id}", status_code=302)
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database error updating user {user_id}: {e}")
        return RedirectResponse(url=f"/users/{user_id}?error=Ошибка сохранения изменений", status_code=302)


@router.post("/{user_id}/delete", response_class=RedirectResponse)
async def user_delete(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    """Удалить пользователя (каскадно удалятся отклики, тикеты поддержки, отзывы с его участием)."""
    if redir := require_admin(request):
        return redir
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user:
        try:
            db.delete(user)
            db.commit()
            logger.info(f"User {user_id} deleted via web interface")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting user {user_id}: {e}")
    else:
        logger.warning(f"Attempt to delete non-existent user {user_id}")
    return RedirectResponse(url="/users", status_code=302)


@router.post("/{user_id}/documents/delete", response_class=RedirectResponse)
async def user_documents_delete(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    """Удалить приложенные документы пользователя (очистить ссылки, чтобы не копились на сервере)."""
    if redir := require_admin(request):
        return redir
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user:
        user.documents = None
        db.commit()
    return RedirectResponse(url=f"/users/{user_id}", status_code=302)


@router.get("/{user_id}", response_class=HTMLResponse)
async def user_detail(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        return RedirectResponse(url="/users", status_code=302)
    documents_list = normalize_documents(user.documents)
    return templates.TemplateResponse(
        "user_detail.html",
        {"request": request, "user": user, "documents_list": documents_list},
    )


@router.get("/export/csv")
async def users_export_csv(
    request: Request,
    db: Session = Depends(get_db),
    role: str | None = Query(None),
    status: str | None = Query(None),
):
    """Export users list as CSV file."""
    if redir := require_admin(request):
        return redir

    q = select(User).order_by(User.id)
    if role:
        q = q.where(User.role == role)
    if status:
        q = q.where(User.status == status)
    users = db.execute(q).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "TG_ID", "ФИО", "Роль", "Статус", "Город", "Телефон", "Навыки", "Дата регистрации"])
    for u in users:
        writer.writerow([
            u.id,
            u.tg_id,
            u.full_name,
            u.role,
            u.status,
            u.city,
            u.phone,
            ", ".join(u.skills) if u.skills else "",
            u.created_at.strftime("%d.%m.%Y %H:%M") if u.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"},
    )
