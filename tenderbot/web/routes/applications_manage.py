# web/routes/applications_manage.py — управление откликами
import logging
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from typing import Annotated

from web.database import get_db
from web.auth import require_admin
from web.miniapp.notify import send_telegram_message
from database.models import TenderApplication, Tender, ApplicationStatus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/applications/{application_id}/select", response_class=HTMLResponse)
async def select_application(
    request: Request,
    application_id: int,
    db: Session = Depends(get_db),
):
    """Выбрать исполнителя по отклику."""
    if redir := require_admin(request):
        return redir
    
    app = db.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.user))
        .where(TenderApplication.id == application_id)
    ).scalar_one_or_none()
    
    if not app:
        logger.warning(f"Attempt to select non-existent application {application_id}")
        return RedirectResponse(url="/applications", status_code=302)
    
    try:
        # Идемпотентно: если уже выбран — просто возвращаемся в карточку.
        if app.status == ApplicationStatus.SELECTED.value:
            return RedirectResponse(url=f"/tenders/{app.tender_id}", status_code=302)

        # Меняем только статус выбранного отклика.
        app.status = ApplicationStatus.SELECTED.value
        
        db.commit()
        # Уведомление выбранному исполнителю
        send_telegram_message(
            app.user.tg_id,
            f"✅ <b>Вас выбрали исполнителем</b>\n\n"
            f"Заказ: «{app.tender.title}». С вами свяжутся для уточнения деталей.",
        )
        logger.info(f"Application {application_id} selected for tender {app.tender_id}")
        return RedirectResponse(url=f"/tenders/{app.tender_id}", status_code=302)
    except Exception as e:
        db.rollback()
        logger.error(f"Error selecting application {application_id}: {e}")
        return RedirectResponse(url=f"/tenders/{app.tender_id}?error=Ошибка выбора исполнителя", status_code=302)


@router.post("/applications/bulk", response_class=RedirectResponse)
async def bulk_applications_action(
    request: Request,
    db: Session = Depends(get_db),
    action: Annotated[str, Form()] = "",
):
    """Массовые действия по откликам: select / reject / delete."""
    if redir := require_admin(request):
        return redir

    form = await request.form()
    app_ids_raw = form.getlist("application_ids")
    tender_id_raw = form.get("tender_id")
    if not tender_id_raw:
        return RedirectResponse(url="/tenders", status_code=302)
    try:
        tender_id = int(str(tender_id_raw))
    except Exception:
        return RedirectResponse(url="/tenders", status_code=302)

    app_ids: list[int] = []
    for v in app_ids_raw:
        try:
            app_ids.append(int(str(v)))
        except Exception:
            continue
    if not app_ids:
        return RedirectResponse(url=f"/tenders/{tender_id}?error=Выберите хотя бы один отклик", status_code=302)

    if action not in {"select", "reject", "delete"}:
        return RedirectResponse(url=f"/tenders/{tender_id}?error=Неизвестное действие", status_code=302)

    apps = db.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.user))
        .where(
            TenderApplication.id.in_(app_ids),
            TenderApplication.tender_id == tender_id,
        )
    ).scalars().all()
    if not apps:
        return RedirectResponse(url=f"/tenders/{tender_id}?error=Отклики не найдены", status_code=302)

    changed = 0
    deleted = 0
    try:
        for app in apps:
            if action == "select":
                if app.status != ApplicationStatus.SELECTED.value:
                    app.status = ApplicationStatus.SELECTED.value
                    changed += 1
                    send_telegram_message(
                        app.user.tg_id,
                        f"✅ <b>Вас выбрали исполнителем</b>\n\n"
                        f"Заказ: «{app.tender.title}». С вами свяжутся для уточнения деталей.",
                    )
            elif action == "reject":
                if app.status != ApplicationStatus.REJECTED.value:
                    app.status = ApplicationStatus.REJECTED.value
                    changed += 1
                    send_telegram_message(
                        app.user.tg_id,
                        f"❌ <b>Отклик отклонён</b>\n\n"
                        f"Заказ: «{app.tender.title}». Можете откликнуться на другие заказы в приложении.",
                    )
            elif action == "delete":
                db.delete(app)
                deleted += 1

        db.commit()
        logger.info(
            "Bulk applications action '%s' for tender %s: changed=%s deleted=%s",
            action, tender_id, changed, deleted,
        )
        return RedirectResponse(url=f"/tenders/{tender_id}", status_code=302)
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk applications action error for tender {tender_id}: {e}")
        return RedirectResponse(url=f"/tenders/{tender_id}?error=Ошибка массовой операции", status_code=302)


@router.post("/applications/{application_id}/reject", response_class=HTMLResponse)
async def reject_application(
    request: Request,
    application_id: int,
    db: Session = Depends(get_db),
):
    """Отклонить отклик."""
    if redir := require_admin(request):
        return redir
    
    app = db.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.user))
        .where(TenderApplication.id == application_id)
    ).scalar_one_or_none()
    
    if not app:
        logger.warning(f"Attempt to reject non-existent application {application_id}")
        return RedirectResponse(url="/applications", status_code=302)
    
    try:
        app.status = ApplicationStatus.REJECTED.value
        db.commit()
        # Уведомление в чат исполнителю
        send_telegram_message(
            app.user.tg_id,
            f"❌ <b>Отклик отклонён</b>\n\n"
            f"Заказ: «{app.tender.title}». Можете откликнуться на другие заказы в приложении.",
        )
        logger.info(f"Application {application_id} rejected")
        return RedirectResponse(url=f"/tenders/{app.tender_id}", status_code=302)
    except Exception as e:
        db.rollback()
        logger.error(f"Error rejecting application {application_id}: {e}")
        return RedirectResponse(url=f"/tenders/{app.tender_id}?error=Ошибка отклонения отклика", status_code=302)

