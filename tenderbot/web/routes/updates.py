import asyncio
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from web.database import get_db
from web.auth import require_admin
from database.models import User, Tender, TenderApplication, Review, SupportTicket, SupportMessage

router = APIRouter()


from web.utils.datetime_helpers import dt_or_min, parse_since


def _max_ts(values: list[datetime | None]) -> datetime:
    return max((dt_or_min(v) for v in values), default=datetime.min.replace(tzinfo=timezone.utc))


def _admin_last_update(db: Session) -> datetime:
    user_ts = db.execute(select(func.max(func.coalesce(User.updated_at, User.created_at)))).scalar()
    tender_ts = db.execute(select(func.max(func.coalesce(Tender.updated_at, Tender.created_at)))).scalar()
    app_ts = db.execute(
        select(func.max(func.coalesce(TenderApplication.updated_at, TenderApplication.created_at)))
    ).scalar()
    review_ts = db.execute(select(func.max(func.coalesce(Review.updated_at, Review.created_at)))).scalar()
    ticket_ts = db.execute(select(func.max(func.coalesce(SupportTicket.updated_at, SupportTicket.created_at)))).scalar()
    msg_ts = db.execute(select(func.max(SupportMessage.created_at))).scalar()
    return _max_ts([user_ts, tender_ts, app_ts, review_ts, ticket_ts, msg_ts])


@router.get("/updates")
async def updates(
    request: Request,
    since: str | None = Query(None),
    timeout: int = Query(25, ge=1, le=60),
    db: Session = Depends(get_db),
):
    if redir := require_admin(request):
        return redir
    since_dt = parse_since(since)
    started = time.time()
    while True:
        current_ts = _admin_last_update(db)
        changed = bool(since_dt and current_ts > since_dt)
        if changed or (time.time() - started) >= timeout or since_dt is None:
            return {"changed": changed, "ts": current_ts.isoformat()}
        await asyncio.sleep(2)  # Non-blocking async sleep
