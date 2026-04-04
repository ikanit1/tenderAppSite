# web/routes/tenders.py
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Request, Depends, Query, Form, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from web.database import get_db
from web.auth import require_admin
from web.templates_loader import templates
from database.models import Tender, User, TenderStatus, TenderApplication
from config import settings
from utils.validators import validate_string_length, validate_date_range

logger = logging.getLogger(__name__)

router = APIRouter()


def _run_status_notifications_sync(tender_id: int, old_status: str, new_status: str) -> None:
    """Фоновая задача: уведомления при смене статуса тендера (отдельная сессия БД)."""
    from web.database import SessionLocal
    from web.utils.notify import notify_matching_executors, notify_tender_applicants, notify_selected_executors

    db = SessionLocal()
    try:
        tender = db.execute(select(Tender).where(Tender.id == tender_id)).scalar_one_or_none()
        if not tender:
            return
        if new_status == TenderStatus.OPEN.value and old_status != TenderStatus.OPEN.value:
            notify_matching_executors(db, tender)
        elif new_status == TenderStatus.CANCELLED.value:
            notify_tender_applicants(
                db, tender,
                f"❌ <b>Тендер отменён</b>\n\n"
                f"Заказ «{tender.title}» был отменён заказчиком.",
            )
        elif new_status == TenderStatus.CLOSED.value:
            notify_selected_executors(
                db, tender,
                f"✅ <b>Тендер завершён</b>\n\n"
                f"Заказ «{tender.title}» закрыт. Спасибо за работу!",
            )
    except Exception as e:
        logger.warning(f"Status notifications failed for tender {tender_id}: {e}")
    finally:
        db.close()


@router.get("", response_class=HTMLResponse)
async def tenders_list(
    request: Request,
    db: Session = Depends(get_db),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    error: str | None = Query(None),
    success: str | None = Query(None),
):
    if redir := require_admin(request):
        return redir

    from web.utils.pagination import get_page_info
    from sqlalchemy import func as sa_func
    PER_PAGE = 20

    q = select(Tender).options(selectinload(Tender.creator)).order_by(Tender.id.desc())
    count_q = select(sa_func.count(Tender.id))
    if status:
        q = q.where(Tender.status == status)
        count_q = count_q.where(Tender.status == status)

    total = db.execute(count_q).scalar() or 0
    page_info = get_page_info(page, PER_PAGE, total)
    tenders = db.execute(q.offset(page_info.offset).limit(page_info.per_page)).scalars().all()

    # Сообщения об ошибках/успехе
    error_msg = None
    success_msg = None
    if error == "tender_not_found":
        error_msg = "Тендер не найден."
    elif error == "delete_failed":
        error_msg = "Не удалось удалить тендер. Возможно, есть связанные данные."
    if success == "tender_deleted":
        success_msg = "Тендер успешно удалён."

    return templates.TemplateResponse(
        request=request,
        name="tenders.html",
        context={
            "tenders": tenders,
            "statuses": [s.value for s in TenderStatus],
            "page_info": page_info,
            "error_msg": error_msg,
            "success_msg": success_msg,
        },
    )


@router.get("/create", response_class=HTMLResponse)
async def tender_create_form(
    request: Request,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    return templates.TemplateResponse(
        request=request,
        name="tender_form.html",
        context={
            "tender": None,
            "skill_tags": settings.SKILL_TAGS,
            "cities": settings.CITIES,
            "statuses": [s.value for s in TenderStatus],
        },
    )


@router.post("/create", response_class=HTMLResponse)
async def tender_create(
    request: Request,
    db: Session = Depends(get_db),
    title: Annotated[str, Form()] = None,
    city: Annotated[str, Form()] = None,
    budget: Annotated[str | None, Form()] = None,
    description: Annotated[str, Form()] = None,
    deadline: Annotated[str | None, Form()] = None,
    status: Annotated[str, Form()] = TenderStatus.DRAFT.value,
):
    if redir := require_admin(request):
        return redir

    form = await request.form()
    categories = [c.strip() for c in form.getlist("categories") if c and str(c).strip()]

    if not (title and str(title).strip() and categories and city and str(city).strip() and description and str(description).strip()):
        return templates.TemplateResponse(
            request=request,
            name="tender_form.html",
            context={
                "tender": None,
                "skill_tags": settings.SKILL_TAGS,
                "cities": settings.CITIES,
                "statuses": [s.value for s in TenderStatus],
                "error": "Заполните обязательные поля: название, минимум одну категорию, город, описание.",
            },
        )

    if city and city not in settings.CITIES:
        return templates.TemplateResponse(
            request=request,
            name="tender_form.html",
            context={
                "tender": None,
                "skill_tags": settings.SKILL_TAGS,
                "cities": settings.CITIES,
                "statuses": [s.value for s in TenderStatus],
                "error": "Выберите город из списка.",
            },
        )

    # Валидация длины полей
    if title:
        is_valid, error_msg = validate_string_length(title, max_length=256, field_name="Название")
        if not is_valid:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": None,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": error_msg,
                },
            )

    if city:
        is_valid, error_msg = validate_string_length(city, max_length=128, field_name="Город")
        if not is_valid:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": None,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": error_msg,
                },
            )
    
    if budget:
        is_valid, error_msg = validate_string_length(budget, max_length=128, field_name="Бюджет")
        if not is_valid:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": None,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": error_msg,
                },
            )
    
    deadline_dt = None
    if deadline:
        try:
            deadline_dt = datetime.strptime(deadline, "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc)
            # Валидация: deadline не должен быть в прошлом
            now_utc = datetime.now(timezone.utc)
            if deadline_dt < now_utc:
                return templates.TemplateResponse(
                    request=request,
                    name="tender_form.html",
                    context={
                        "tender": None,
                        "skill_tags": settings.SKILL_TAGS,
                        "cities": settings.CITIES,
                        "statuses": [s.value for s in TenderStatus],
                        "error": "Срок приёма откликов не может быть в прошлом",
                    },
                )
        except ValueError:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": None,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": "Неверный формат даты",
                },
            )
    
    try:
        tender = Tender(
            title=title,
            categories=categories,
            city=city,
            budget=budget,
            description=description,
            deadline=deadline_dt,
            status=status,
            created_by_tg_id=settings.ADMIN_ID,
        )
        db.add(tender)
        db.commit()
        db.refresh(tender)
        logger.info(f"Tender {tender.id} created via web interface")
        return RedirectResponse(url=f"/tenders/{tender.id}", status_code=302)
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database error creating tender: {e}")
        return templates.TemplateResponse(
            request=request,
            name="tender_form.html",
            context={
                "tender": None,
                "skill_tags": settings.SKILL_TAGS,
                "cities": settings.CITIES,
                "statuses": [s.value for s in TenderStatus],
                "error": "Ошибка сохранения тендера. Попробуйте снова.",
            },
        )


@router.get("/{tender_id}/edit", response_class=HTMLResponse)
async def tender_edit_form(
    request: Request,
    tender_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    tender = db.execute(select(Tender).where(Tender.id == tender_id)).scalar_one_or_none()
    if not tender:
        return RedirectResponse(url="/tenders", status_code=302)
    return templates.TemplateResponse(
        request=request,
        name="tender_form.html",
        context={
            "tender": tender,
            "skill_tags": settings.SKILL_TAGS,
            "cities": settings.CITIES,
            "statuses": [s.value for s in TenderStatus],
        },
    )


@router.post("/{tender_id}/edit", response_class=HTMLResponse)
async def tender_update(
    request: Request,
    tender_id: int,
    db: Session = Depends(get_db),
    title: Annotated[str, Form()] = None,
    city: Annotated[str, Form()] = None,
    budget: Annotated[str | None, Form()] = None,
    description: Annotated[str, Form()] = None,
    deadline: Annotated[str | None, Form()] = None,
    status: Annotated[str, Form()] = None,
):
    if redir := require_admin(request):
        return redir
    
    tender = db.execute(select(Tender).where(Tender.id == tender_id)).scalar_one_or_none()
    if not tender:
        logger.warning(f"Attempt to edit non-existent tender {tender_id}")
        return RedirectResponse(url="/tenders", status_code=302)
    
    # Валидация длины полей
    if title:
        is_valid, error_msg = validate_string_length(title, max_length=256, field_name="Название")
        if not is_valid:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": tender,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": error_msg,
                },
            )
    
    form = await request.form()
    categories = [c.strip() for c in form.getlist("categories") if c and str(c).strip()]

    if not categories:
        return templates.TemplateResponse(
            request=request,
            name="tender_form.html",
            context={
                "tender": tender,
                "skill_tags": settings.SKILL_TAGS,
                "cities": settings.CITIES,
                "statuses": [s.value for s in TenderStatus],
                "error": "Выберите минимум одну категорию.",
            },
        )

    if city and city not in settings.CITIES:
        return templates.TemplateResponse(
            request=request,
            name="tender_form.html",
            context={
                "tender": tender,
                "skill_tags": settings.SKILL_TAGS,
                "cities": settings.CITIES,
                "statuses": [s.value for s in TenderStatus],
                "error": "Выберите город из списка.",
            },
        )

    if city:
        is_valid, error_msg = validate_string_length(city, max_length=128, field_name="Город")
        if not is_valid:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": tender,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": error_msg,
                },
            )
    
    if budget:
        is_valid, error_msg = validate_string_length(budget, max_length=128, field_name="Бюджет")
        if not is_valid:
            return templates.TemplateResponse(
                request=request,
                name="tender_form.html",
                context={
                    "tender": tender,
                    "skill_tags": settings.SKILL_TAGS,
                    "cities": settings.CITIES,
                    "statuses": [s.value for s in TenderStatus],
                    "error": error_msg,
                },
            )
    
    try:
        tender.title = title
        tender.categories = categories
        tender.city = city
        tender.budget = budget
        tender.description = description
        
        if deadline:
            try:
                deadline_dt = datetime.strptime(deadline, "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc)
                # Валидация: deadline не должен быть в прошлом
                now_utc = datetime.now(timezone.utc)
                if deadline_dt < now_utc:
                    return templates.TemplateResponse(
                        request=request,
                        name="tender_form.html",
                        context={
                            "tender": tender,
                            "skill_tags": settings.SKILL_TAGS,
                            "statuses": [s.value for s in TenderStatus],
                            "error": "Срок приёма откликов не может быть в прошлом",
                        },
                    )
                tender.deadline = deadline_dt
            except ValueError:
                return templates.TemplateResponse(
                    request=request,
                    name="tender_form.html",
                    context={
                        "tender": tender,
                        "skill_tags": settings.SKILL_TAGS,
                        "statuses": [s.value for s in TenderStatus],
                        "error": "Неверный формат даты",
                    },
                )
        else:
            tender.deadline = None
        
        if status:
            tender.status = status
        
        db.commit()
        logger.info(f"Tender {tender_id} updated via web interface")
        return RedirectResponse(url=f"/tenders/{tender.id}", status_code=302)
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database error updating tender {tender_id}: {e}")
        return templates.TemplateResponse(
            request=request,
            name="tender_form.html",
            context={
                "tender": tender,
                "skill_tags": settings.SKILL_TAGS,
                "statuses": [s.value for s in TenderStatus],
                "error": "Ошибка сохранения изменений. Попробуйте снова.",
            },
        )


@router.post("/{tender_id}/status", response_class=RedirectResponse)
async def tender_change_status(
    request: Request,
    tender_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    new_status: Annotated[str, Form()] = None,
):
    if redir := require_admin(request):
        return redir
    
    tender = db.execute(select(Tender).where(Tender.id == tender_id)).scalar_one_or_none()
    if not tender:
        return RedirectResponse(url="/tenders", status_code=302)
    
    old_status = tender.status
    if new_status in [s.value for s in TenderStatus]:
        tender.status = new_status
        db.commit()

        # Уведомления в фоне (отдельная сессия, выполняется после ответа)
        if new_status in (TenderStatus.OPEN.value, TenderStatus.CANCELLED.value, TenderStatus.CLOSED.value):
            background_tasks.add_task(_run_status_notifications_sync, tender_id, old_status, new_status)

    return RedirectResponse(url=f"/tenders/{tender_id}", status_code=302)


@router.post("/{tender_id}/delete", response_class=RedirectResponse)
async def tender_delete(
    request: Request,
    tender_id: int,
    db: Session = Depends(get_db),
):
    """Удалить тендер (каскадно удалятся отклики)."""
    if redir := require_admin(request):
        return redir
    tender = db.execute(select(Tender).where(Tender.id == tender_id)).scalar_one_or_none()
    if not tender:
        logger.warning(f"Attempt to delete non-existent tender {tender_id}")
        return RedirectResponse(url="/tenders?error=tender_not_found", status_code=302)
    
    try:
        db.delete(tender)
        db.commit()
        logger.info(f"Tender {tender_id} deleted via web interface")
        return RedirectResponse(url="/tenders?success=tender_deleted", status_code=302)
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error deleting tender {tender_id}: {e}")
        return RedirectResponse(url=f"/tenders?error=delete_failed&tender_id={tender_id}", status_code=302)
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting tender {tender_id}: {e}", exc_info=True)
        return RedirectResponse(url=f"/tenders?error=delete_failed&tender_id={tender_id}", status_code=302)


@router.get("/{tender_id}", response_class=HTMLResponse)
async def tender_detail(
    request: Request,
    tender_id: int,
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    tender = db.execute(
        select(Tender)
        .options(selectinload(Tender.creator), selectinload(Tender.applications).selectinload(TenderApplication.user))
        .where(Tender.id == tender_id)
    ).scalar_one_or_none()
    if not tender:
        return RedirectResponse(url="/tenders", status_code=302)
    return templates.TemplateResponse(
        request=request,
        name="tender_detail.html",
        context={
            "tender": tender,
            "statuses": [s.value for s in TenderStatus],
        },
    )
