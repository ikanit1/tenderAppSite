# web/routes/reviews.py
from fastapi import APIRouter, Request, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from web.database import get_db
from web.auth import require_admin
from web.templates_loader import templates
from database.models import Review, User

router = APIRouter()


@router.post("/{review_id}/delete", response_class=RedirectResponse)
async def review_delete(
    request: Request,
    review_id: int,
    db: Session = Depends(get_db),
):
    """Удалить отзыв (например некорректный)."""
    if redir := require_admin(request):
        return redir
    review = db.execute(select(Review).where(Review.id == review_id)).scalar_one_or_none()
    if review:
        db.delete(review)
        db.commit()
    return RedirectResponse(url="/reviews", status_code=302)


@router.get("", response_class=HTMLResponse)
async def reviews_list(
    request: Request,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
):
    if redir := require_admin(request):
        return redir

    from web.utils.pagination import get_page_info
    PER_PAGE = 20

    total = db.execute(select(func.count(Review.id))).scalar() or 0
    page_info = get_page_info(page, PER_PAGE, total)

    reviews = db.execute(
        select(Review).order_by(Review.created_at.desc())
        .offset(page_info.offset).limit(page_info.per_page)
    ).scalars().all()
    result = db.execute(
        select(Review.to_user_id, func.avg(Review.rating), func.count(Review.id))
        .group_by(Review.to_user_id)
    )
    avg_by_user = {row[0]: (float(row[1]) if row[1] else 0, row[2]) for row in result.all()}
    return templates.TemplateResponse(
        "reviews.html",
        {"request": request, "reviews": reviews, "avg_by_user": avg_by_user, "page_info": page_info},
    )
