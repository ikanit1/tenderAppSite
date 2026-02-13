# web/routes/applications.py
from fastapi import APIRouter, Request, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from web.database import get_db
from web.auth import require_admin
from web.templates_loader import templates
from database.models import TenderApplication

router = APIRouter()


@router.post("/{application_id}/delete", response_class=RedirectResponse)
async def application_delete(
    request: Request,
    application_id: int,
    db: Session = Depends(get_db),
):
    """Удалить отклик (например ошибочный или спам)."""
    if redir := require_admin(request):
        return redir
    app = db.execute(select(TenderApplication).where(TenderApplication.id == application_id)).scalar_one_or_none()
    if app:
        tender_id = app.tender_id
        db.delete(app)
        db.commit()
        return RedirectResponse(url=f"/tenders/{tender_id}", status_code=302)
    return RedirectResponse(url="/applications", status_code=302)


@router.get("", response_class=HTMLResponse)
async def applications_list(
    request: Request,
    db: Session = Depends(get_db),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
):
    if redir := require_admin(request):
        return redir

    from web.utils.pagination import get_page_info
    PER_PAGE = 20

    q = (
        select(TenderApplication)
        .options(
            selectinload(TenderApplication.tender),
            selectinload(TenderApplication.user),
        )
        .order_by(TenderApplication.id.desc())
    )
    count_q = select(func.count(TenderApplication.id))
    if status:
        q = q.where(TenderApplication.status == status)
        count_q = count_q.where(TenderApplication.status == status)

    total = db.execute(count_q).scalar() or 0
    page_info = get_page_info(page, PER_PAGE, total)
    applications = db.execute(q.offset(page_info.offset).limit(page_info.per_page)).scalars().all()

    return templates.TemplateResponse(
        "applications.html",
        {"request": request, "applications": applications, "page_info": page_info},
    )
