# services/tender_scheduler.py — фоновая задача: автозакрытие просроченных тендеров + напоминания
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database.models import (
    Tender, TenderApplication, TenderStatus,
)

logger = logging.getLogger(__name__)

# Интервал проверки (секунды)
CHECK_INTERVAL = settings.TENDER_SCHEDULER_INTERVAL_SECONDS
# За сколько до дедлайна отправлять напоминание
REMIND_BEFORE = timedelta(hours=settings.TENDER_REMIND_BEFORE_HOURS)
# Через сколько часов без откликов уведомлять админа/создателя
NO_APPS_ALERT_AFTER = timedelta(hours=settings.TENDER_NO_APPS_ALERT_HOURS)

# Кэш отправленных напоминаний (tender_id -> True).
# Сбрасывается при перезапуске — возможно повторное напоминание одному тендеру после рестарта.
_reminded_tenders: set[int] = set()
# Кэш отправленных алертов об отсутствии откликов (tender_id -> True).
_no_apps_alerted_tenders: set[int] = set()


async def _auto_close_expired(session: AsyncSession, bot) -> int:
    """Закрыть тендеры с истекшим дедлайном и уведомить участников.

    В БД deadline хранится как TIMESTAMP WITHOUT TIME ZONE (naive UTC),
    поэтому в запросы нужно передавать наивные datetime в UTC, иначе
    asyncpg ругается на смешение offset-aware/naive.
    """
    now = datetime.utcnow()
    result = await session.execute(
        select(Tender)
        .options(selectinload(Tender.creator))
        .where(
            Tender.status == TenderStatus.OPEN.value,
            Tender.deadline.isnot(None),
            Tender.deadline < now,
        )
    )
    expired = result.scalars().all()
    if not expired:
        return 0

    closed_count = 0
    for tender in expired:
        tender.status = TenderStatus.CLOSED.value
        await session.flush()

        # Уведомить создателя
        if tender.creator and tender.creator.tg_id:
            try:
                await bot.send_message(
                    tender.creator.tg_id,
                    f"⏰ <b>Дедлайн истёк</b>\n\n"
                    f"Тендер «{tender.title}» автоматически закрыт — срок приёма откликов истёк.",
                )
            except Exception as e:
                logger.warning(f"Failed to notify creator {tender.creator.tg_id}: {e}")

        # Уведомить всех откликнувшихся
        apps_result = await session.execute(
            select(TenderApplication)
            .options(selectinload(TenderApplication.user))
            .where(TenderApplication.tender_id == tender.id)
        )
        for app in apps_result.scalars().all():
            try:
                await bot.send_message(
                    app.user.tg_id,
                    f"⏰ <b>Тендер закрыт</b>\n\n"
                    f"Заказ «{tender.title}» закрыт — срок приёма откликов истёк.",
                )
            except Exception as e:
                logger.warning(f"Failed to notify applicant {app.user.tg_id}: {e}")

        closed_count += 1
        logger.info(f"Tender {tender.id} auto-closed (deadline expired)")

    return closed_count


async def _send_deadline_reminders(session: AsyncSession, bot) -> int:
    """Напомнить создателям о тендерах с дедлайном менее 24ч."""
    now = datetime.utcnow()
    remind_threshold = now + REMIND_BEFORE

    result = await session.execute(
        select(Tender)
        .options(selectinload(Tender.creator))
        .where(
            Tender.status == TenderStatus.OPEN.value,
            Tender.deadline.isnot(None),
            Tender.deadline > now,
            Tender.deadline <= remind_threshold,
        )
    )
    tenders = result.scalars().all()
    reminded = 0

    for tender in tenders:
        if tender.id in _reminded_tenders:
            continue
        _reminded_tenders.add(tender.id)

        if tender.creator and tender.creator.tg_id:
            dl_str = tender.deadline.strftime("%d.%m.%Y %H:%M") if tender.deadline else ""
            try:
                await bot.send_message(
                    tender.creator.tg_id,
                    f"⏳ <b>Напоминание о дедлайне</b>\n\n"
                    f"До окончания приёма откликов по тендеру «{tender.title}» "
                    f"осталось менее 24 часов (дедлайн: {dl_str}).",
                )
                reminded += 1
            except Exception as e:
                logger.warning(f"Failed to send deadline reminder for tender {tender.id}: {e}")

    if reminded:
        logger.info(f"Sent {reminded} deadline reminders")
    return reminded


async def _notify_idle_open_tenders(session: AsyncSession, bot) -> int:
    """Уведомить, если тендер открыт, но нет откликов дольше порога."""
    now = datetime.utcnow()
    threshold = now - NO_APPS_ALERT_AFTER

    result = await session.execute(
        select(Tender)
        .options(selectinload(Tender.creator))
        .where(
            Tender.status == TenderStatus.OPEN.value,
            Tender.created_at.isnot(None),
            Tender.created_at <= threshold,
        )
    )
    tenders = result.scalars().all()
    alerted = 0

    for tender in tenders:
        if tender.id in _no_apps_alerted_tenders:
            continue
        apps_result = await session.execute(
            select(TenderApplication.id).where(TenderApplication.tender_id == tender.id)
        )
        has_apps = apps_result.first() is not None
        if has_apps:
            _no_apps_alerted_tenders.add(tender.id)
            continue

        _no_apps_alerted_tenders.add(tender.id)
        text = (
            f"⚠️ <b>Нет откликов</b>\n\n"
            f"По тендеру «{tender.title}» более {settings.TENDER_NO_APPS_ALERT_HOURS} ч. нет откликов.\n"
            f"Рекомендуется скорректировать описание/бюджет или продлить срок приема заявок."
        )
        # Уведомляем администратора
        try:
            await bot.send_message(settings.ADMIN_ID, text)
            alerted += 1
        except Exception as e:
            logger.warning(f"Failed to alert admin for idle tender {tender.id}: {e}")
        # И дополнительно создателя (если он не админ)
        if tender.creator and tender.creator.tg_id and tender.creator.tg_id != settings.ADMIN_ID:
            try:
                await bot.send_message(tender.creator.tg_id, text)
            except Exception as e:
                logger.warning(f"Failed to alert creator for idle tender {tender.id}: {e}")

    if alerted:
        logger.info("Sent %s no-applications alerts", alerted)
    return alerted


async def tender_scheduler_loop(bot) -> None:
    """Основной цикл планировщика тендеров. Запускается как asyncio.task в main.py."""
    from database.session import get_async_session_maker

    logger.info("Tender scheduler started (interval: %ds)", CHECK_INTERVAL)

    while True:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            closed = reminded = no_apps_alerted = 0
            try:
                closed = await _auto_close_expired(session, bot)
            except Exception as e:
                logger.exception("Scheduler task _auto_close_expired failed: %s", e)
            try:
                reminded = await _send_deadline_reminders(session, bot)
            except Exception as e:
                logger.exception("Scheduler task _send_deadline_reminders failed: %s", e)
            try:
                no_apps_alerted = await _notify_idle_open_tenders(session, bot)
            except Exception as e:
                logger.exception("Scheduler task _notify_idle_open_tenders failed: %s", e)
            try:
                await session.commit()
                if closed or reminded or no_apps_alerted:
                    logger.info(
                        "Scheduler tick: closed=%s, reminded=%s, no_apps_alerted=%s",
                        closed, reminded, no_apps_alerted,
                    )
            except Exception as e:
                logger.exception("Scheduler commit failed: %s", e)
                await session.rollback()

        await asyncio.sleep(CHECK_INTERVAL)
