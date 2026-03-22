# web/utils/notify.py — уведомления исполнителей при действиях через веб-админку
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select

from config import settings
from database.models import User, Tender, TenderApplication, UserStatus, ApplicationStatus
from web.miniapp.notify import send_telegram_message

logger = logging.getLogger(__name__)


def notify_matching_executors(db: Session, tender: Tender) -> int:
    """Уведомить matching исполнителей о новом тендере. Возвращает кол-во отправленных."""
    result = db.execute(
        select(User).where(
            User.status == UserStatus.ACTIVE.value,
            User.city == tender.city,
        )
    )
    all_city = result.scalars().all()
    tender_cats = tender.categories or []
    users = [
        u for u in all_city
        if u.role in ("executor", "both")
        and (u.skills or [])
        and any(c in (u.skills or []) for c in tender_cats)
    ]
    if not users:
        return 0

    deadline_text = (
        tender.deadline.strftime("%d.%m.%Y %H:%M")
        if tender.deadline
        else "не указан"
    )
    text = (
        f"📋 <b>Новый заказ!</b>\n\n"
        f"<b>{tender.title}</b>\n"
        f"📍 {tender.city} | 🏷️ {', '.join(tender.categories or [])}\n"
        f"⏰ Прием заявок до: {deadline_text}\n"
        f"💰 {tender.budget or 'по договорённости'}\n\n"
        f"{(tender.description or '')[:200]}\n\n"
        f"ℹ️ После дедлайна статус тендера может измениться автоматически.\n"
        f"📱 Подробнее можно посмотреть в приложении."
    )
    reply_markup = {
        "inline_keyboard": [[{
            "text": "📩 Откликнуться",
            "callback_data": f"apply:{tender.id}",
        }]]
    }
    sent = 0
    for u in users:
        if send_telegram_message(u.tg_id, text, reply_markup=reply_markup):
            sent += 1
    logger.info(f"Tender {tender.id} published via web: notified {sent}/{len(users)} executors")
    return sent


def notify_tender_applicants(db: Session, tender: Tender, text: str) -> int:
    """Уведомить всех откликнувшихся на тендер."""
    result = db.execute(
        select(TenderApplication)
        .where(TenderApplication.tender_id == tender.id)
    )
    apps = result.scalars().all()
    if not apps:
        return 0

    # Загружаем пользователей
    user_ids = [a.user_id for a in apps]
    result = db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in result.scalars().all()}

    sent = 0
    for app in apps:
        user = users_map.get(app.user_id)
        if user:
            if send_telegram_message(user.tg_id, text):
                sent += 1
    return sent


def notify_selected_executors(db: Session, tender: Tender, text: str) -> int:
    """Уведомить всех выбранных исполнителей по тендеру."""
    result = db.execute(
        select(TenderApplication)
        .where(
            TenderApplication.tender_id == tender.id,
            TenderApplication.status == ApplicationStatus.SELECTED.value,
        )
    )
    apps = result.scalars().all()
    if not apps:
        return 0

    user_ids = [a.user_id for a in apps]
    result = db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in result.scalars().all()}

    sent = 0
    for app in apps:
        user = users_map.get(app.user_id)
        if user and send_telegram_message(user.tg_id, text):
            sent += 1
    return sent


def notify_selected_executor(db: Session, tender: Tender, text: str) -> bool:
    """Backward-compatible wrapper: уведомить хотя бы одного выбранного."""
    return notify_selected_executors(db, tender, text) > 0
