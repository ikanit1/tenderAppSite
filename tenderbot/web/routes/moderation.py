# web/routes/moderation.py — модерация пользователей
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Annotated

from web.database import get_db
from web.auth import require_admin
from web.templates_loader import templates
from web.utils.audit import log_action
from database.models import User, UserStatus

router = APIRouter()


@router.post("/users/{user_id}/approve", response_class=HTMLResponse)
async def approve_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user:
        old_status = user.status
        user.status = UserStatus.ACTIVE.value
        log_action(db, "user.approve", "user", user_id, details={"old_status": old_status})
        db.commit()
    
    return RedirectResponse(url=f"/users/{user_id}", status_code=302)


@router.post("/users/{user_id}/reject", response_class=HTMLResponse)
async def reject_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user:
        old_status = user.status
        user.status = UserStatus.BANNED.value
        log_action(db, "user.reject", "user", user_id, details={"old_status": old_status})
        db.commit()
    
    return RedirectResponse(url=f"/users/{user_id}", status_code=302)


@router.post("/users/{user_id}/ban", response_class=HTMLResponse)
async def ban_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user:
        old_status = user.status
        user.status = UserStatus.BANNED.value
        log_action(db, "user.ban", "user", user_id, details={"old_status": old_status})
        db.commit()
    
    return RedirectResponse(url=f"/users/{user_id}", status_code=302)


@router.post("/users/{user_id}/unban", response_class=HTMLResponse)
async def unban_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user:
        old_status = user.status
        user.status = UserStatus.ACTIVE.value
        log_action(db, "user.unban", "user", user_id, details={"old_status": old_status})
        db.commit()
    
    return RedirectResponse(url=f"/users/{user_id}", status_code=302)

