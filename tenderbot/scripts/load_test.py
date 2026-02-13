#!/usr/bin/env python3
"""
Скрипт тестирования устойчивости: эмулирует 3-6 исполнителей.
Создаёт тестовых пользователей, отслеживает новые OPEN-тендеры и «умно» откликается.
Запуск из корня проекта: python scripts/load_test.py
"""
import argparse
import logging
import random
import sys
import time
from pathlib import Path

# Добавляем корень проекта в path
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from config import settings
from database.models import User, Tender, TenderApplication, UserStatus, TenderStatus
from web.database import SessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Диапазон tg_id для тестовых пользователей (не пересекаться с реальными)
TG_ID_MIN = 900001
TG_ID_MAX = 900009

# Тестовые данные
TEST_NAMES = [
    "Тестов Иван",
    "Тестова Мария",
    "Проверкин Петр",
    "Симуляков Алексей",
    "Демов Дмитрий",
    "Эмулянтов Сергей",
]


def _ensure_test_users(db: Session, count: int, reset: bool) -> list[User]:
    """Создаёт или возвращает тестовых пользователей."""
    if reset:
        # Удаляем отклики тестовых пользователей
        existing = db.execute(
            select(User).where(User.tg_id >= TG_ID_MIN, User.tg_id <= TG_ID_MAX)
        ).scalars().all()
        for u in existing:
            db.execute(
                delete(TenderApplication).where(TenderApplication.user_id == u.id)
            )
        db.execute(
            delete(User).where(User.tg_id >= TG_ID_MIN, User.tg_id <= TG_ID_MAX)
        )
        db.commit()
        logger.info("Удалены старые тестовые пользователи")

    skills_all = list(settings.SKILL_TAGS)
    if not skills_all:
        skills_all = ["СКУД", "Видеонаблюдение", "АПС", "Электромонтаж"]

    created = []
    for i in range(count):
        tg_id = TG_ID_MIN + i
        existing = db.execute(select(User).where(User.tg_id == tg_id)).scalar_one_or_none()
        if existing:
            created.append(existing)
            continue

        n_skills = random.randint(1, min(3, len(skills_all)))
        skills = random.sample(skills_all, n_skills)
        city = random.choice(settings.CITIES)
        name = TEST_NAMES[i % len(TEST_NAMES)]

        user = User(
            tg_id=tg_id,
            full_name=name,
            birth_date=None,
            city=city,
            phone=f"+7900{i}{i}{i}{i}{i}{i}{i}",
            role="executor",
            skills=skills,
            status=UserStatus.ACTIVE.value,
        )
        db.add(user)
        db.flush()
        created.append(user)
        logger.info("Создан тестовый пользователь: tg_id=%s, %s, %s, skills=%s", tg_id, name, city, skills)

    db.commit()
    return created


def _get_matching_users(db: Session, tender: Tender) -> list[User]:
    """Пользователи, подходящие для отклика: city + category в skills."""
    result = db.execute(
        select(User).where(
            User.status == UserStatus.ACTIVE.value,
            User.city == tender.city,
        )
    )
    users = []
    for u in result.scalars().all():
        tender_cats = tender.categories or []
        if u.role in ("executor", "both") and (u.skills or []) and any(c in (u.skills or []) for c in tender_cats):
            users.append(u)
    return users


def _apply_to_tender(db: Session, tender: Tender, user: User) -> bool:
    """Отклик пользователя на тендер. Возвращает True если отклик добавлен."""
    existing = db.execute(
        select(TenderApplication).where(
            TenderApplication.tender_id == tender.id,
            TenderApplication.user_id == user.id,
        )
    ).scalar_one_or_none()
    if existing:
        return False
    app = TenderApplication(tender_id=tender.id, user_id=user.id, status="applied")
    db.add(app)
    db.commit()
    return True


def _process_new_tenders(db: Session, last_seen_id: int) -> int:
    """Обрабатывает новые OPEN-тендеры, возвращает новый last_seen_id."""
    result = db.execute(
        select(Tender)
        .where(Tender.status == TenderStatus.OPEN.value, Tender.id > last_seen_id)
        .order_by(Tender.id)
    )
    tenders = result.scalars().all()
    new_max = last_seen_id

    for tender in tenders:
        new_max = max(new_max, tender.id)
        users = _get_matching_users(db, tender)
        applied = 0
        for u in users:
            if _apply_to_tender(db, tender, u):
                applied += 1
                logger.info(
                    "Отклик: пользователь tg_id=%s на тендер #%s «%s»",
                    u.tg_id, tender.id, tender.title[:50],
                )
                time.sleep(random.uniform(1, 5))
        if applied:
            logger.info("Тендер #%s: %s откликов от тестовых пользователей", tender.id, applied)

    return new_max


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Скрипт тестирования устойчивости: тестовые пользователи и отклики на тендеры",
    )
    parser.add_argument(
        "--users",
        type=int,
        default=4,
        choices=range(3, 7),
        metavar="N",
        help="Количество тестовых пользователей (3-6)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        metavar="SEC",
        help="Интервал опроса БД (сек)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Только создать пользователей, не опрашивать",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Удалить старых тестовых пользователей перед созданием",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        users = _ensure_test_users(db, args.users, args.reset)
        logger.info("Готово %s тестовых пользователей", len(users))

        if args.dry_run:
            return

        last_seen_id = 0
        logger.info("Запуск цикла опроса (интервал %s сек). Ctrl+C для выхода.", args.interval)
        while True:
            try:
                last_seen_id = _process_new_tenders(db, last_seen_id)
            except Exception as e:
                logger.exception("Ошибка при обработке тендеров: %s", e)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        logger.info("Остановлено пользователем")
    finally:
        db.close()


if __name__ == "__main__":
    main()
