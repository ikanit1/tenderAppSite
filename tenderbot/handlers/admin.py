# handlers/admin.py — модерация пользователей и создание тендеров
import logging
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.types import MenuButtonWebApp, WebAppInfo
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database.models import User, Tender, TenderApplication, Review, UserStatus, TenderStatus, ApplicationStatus
from states.admin import ReviewStates, AddTenderStates
from utils import is_admin
from utils.chat_utils import answer_with_cleanup
from utils.validators import parse_callback_id, parse_callback_parts
from utils.menu_updater import send_notification_with_menu_update, refresh_user_menu_on_state_change
from utils.fsm_clear import clear_user_fsm
from services.user_service import UserService
from handlers.keyboards import get_miniapp_url

logger = logging.getLogger(__name__)

router = Router()


# ——— Модерация: Одобрить / Отклонить ———
@router.callback_query(F.data.startswith("mod_approve:"))
async def moderation_approve(
    callback: CallbackQuery,
    session: AsyncSession,
) -> None:
    if not is_admin(callback.from_user.id):
        await callback.answer("Доступ запрещён.", show_alert=True)
        return
    
    user_id = parse_callback_id(callback.data, "mod_approve:")
    if user_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        await callback.answer("Пользователь не найден.", show_alert=True)
        return
    
    old_status = user.status
    updated_user = await UserService.update_user_status(session, user_id, UserStatus.ACTIVE.value)
    if not updated_user:
        await callback.answer("Ошибка обновления статуса.", show_alert=True)
        return
    
    await callback.message.edit_text(
        callback.message.text + "\n\n✅ Одобрено."
    )
    
    # Уведомление в чат
    notification_text = (
        "✅ <b>Ваша заявка одобрена!</b>\n\n"
        "Теперь вы можете смотреть заказы и откликаться.\n\n"
        "Нажмите <b>«📱 Открыть приложение»</b> в меню."
    )
    await send_notification_with_menu_update(
        bot=callback.bot,
        user_tg_id=updated_user.tg_id,
        message_text=notification_text,
        session=session,
        update_menu=True,
    )
    
    # Обновляем меню при изменении статуса
    await refresh_user_menu_on_state_change(
        bot=callback.bot,
        user_tg_id=updated_user.tg_id,
        session=session,
        old_status=old_status,
        new_status=updated_user.status,
    )
    
    logger.info(f"User {user_id} approved by admin {callback.from_user.id}")
    await callback.answer("Пользователь одобрен.")


@router.callback_query(F.data.startswith("mod_reject:"))
async def moderation_reject(
    callback: CallbackQuery,
    session: AsyncSession,
) -> None:
    if not is_admin(callback.from_user.id):
        await callback.answer("Доступ запрещён.", show_alert=True)
        return
    
    user_id = parse_callback_id(callback.data, "mod_reject:")
    if user_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        await callback.answer("Пользователь не найден.", show_alert=True)
        return
    
    old_status = user.status
    updated_user = await UserService.update_user_status(session, user_id, UserStatus.BANNED.value)
    if not updated_user:
        await callback.answer("Ошибка обновления статуса.", show_alert=True)
        return
    
    await callback.message.edit_text(
        callback.message.text + "\n\n❌ Отклонено."
    )
    
    # Отправляем уведомление с автоматическим обновлением меню
    notification_text = (
        "❌ <b>Ваша заявка отклонена</b>\n\n"
        "К сожалению, ваша заявка на регистрацию была отклонена администратором.\n"
        "Если у вас есть вопросы, обратитесь в поддержку."
    )
    await send_notification_with_menu_update(
        bot=callback.bot,
        user_tg_id=updated_user.tg_id,
        message_text=notification_text,
        session=session,
        update_menu=True,
    )
    
    # Обновляем меню при изменении статуса
    await refresh_user_menu_on_state_change(
        bot=callback.bot,
        user_tg_id=updated_user.tg_id,
        session=session,
        old_status=old_status,
        new_status=updated_user.status,
    )
    # Сбрасываем FSM (регистрация, поддержка и т.д.), чтобы при разбане пользователь не попал в середину флоу
    await clear_user_fsm(callback.bot, updated_user.tg_id)

    logger.info(f"User {user_id} rejected by admin {callback.from_user.id}")
    await callback.answer("Пользователь отклонён.")


@router.message(Command("refresh_menu"))
async def cmd_refresh_menu(message: Message) -> None:
    """Обновить кнопку меню (Mini App URL) для всех пользователей после смены MINIAPP_BASE_URL."""
    if not is_admin(message.from_user.id):
        await message.answer("Доступ только для администратора.")
        return
    url = get_miniapp_url()
    if not url:
        await message.answer("MINIAPP_BASE_URL не задан в .env — кнопка меню не обновлена.")
        return
    try:
        await message.bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Открыть приложение",
                web_app=WebAppInfo(url=url),
            ),
        )
        await message.answer(f"✅ Кнопка меню обновлена: {url}")
        logger.info("Menu button refreshed by admin: %s", url)
    except Exception as e:
        logger.warning("refresh_menu failed: %s", e)
        await message.answer(f"Ошибка обновления кнопки меню: {e}")


@router.message(F.text == "⚙️ Админ-панель")
@router.message(F.text == "🏠 Главное меню")
async def cmd_admin_menu(message: Message, session: AsyncSession, state: FSMContext) -> None:
    """Переключение между админ-меню и главным меню."""
    # Отменяем FSM состояние, если оно активно
    current_state = await state.get_state()
    if current_state:
        await state.clear()
    
    from handlers.keyboards import get_admin_menu_kb, get_main_menu_kb
    result = await session.execute(select(User).where(User.tg_id == message.from_user.id))
    user = result.scalar_one_or_none()
    
    if message.text == "⚙️ Админ-панель":
        if not is_admin(message.from_user.id):
            await answer_with_cleanup(message, "❌ Доступ только для администратора.")
            return
        await answer_with_cleanup(
            message,
            "⚙️ <b>Админ-панель</b>\n\n"
            "Выберите действие:",
            reply_markup=get_admin_menu_kb(),
        )
    elif message.text == "🏠 Главное меню":
        # Всегда показываем актуальное меню с учетом текущего состояния
        from utils.menu_updater import ensure_menu_visible
        await ensure_menu_visible(
            bot=message.bot,
            user_tg_id=message.from_user.id,
            session=session,
            welcome_text="🏠 <b>Главное меню</b>",
        )


@router.message(F.text == "👥 Модерация")
async def cmd_moderation(message: Message, session: AsyncSession, state: FSMContext) -> None:
    """Просмотр заявок на модерацию."""
    # Отменяем FSM состояние, если оно активно
    current_state = await state.get_state()
    if current_state:
        await state.clear()
    
    if not is_admin(message.from_user.id):
        await answer_with_cleanup(message, "❌ Доступ только для администратора.")
        return
    
    result = await session.execute(
        select(User).where(User.status == UserStatus.PENDING_MODERATION.value)
        .order_by(User.id.desc())
        .limit(10)
    )
    users = result.scalars().all()
    
    if not users:
        await answer_with_cleanup(message, "✅ Нет заявок на модерацию.")
        return
    
    from handlers.keyboards import get_moderation_kb
    for user in users:
        role_str = "Исполнитель" if user.role == "executor" else (user.role or "—")
        skills_str = ", ".join(user.skills) if user.skills else "—"
        text = (
            f"🆕 <b>Новая заявка</b>\n\n"
            f"ФИО: {user.full_name}\n"
            f"Роль: {role_str}\n"
            f"Город: {user.city}\n"
            f"Телефон: {user.phone}\n"
            f"Навыки: {skills_str}\n"
            f"TG ID: {user.tg_id}"
        )
        await answer_with_cleanup(message, text, reply_markup=get_moderation_kb(user.id))


@router.message(F.text == "👷 Рабочие")
async def cmd_workers_button(message: Message, session: AsyncSession, state: FSMContext) -> None:
    """Обработчик кнопки 'Рабочие'."""
    # Отменяем FSM состояние, если оно активно
    current_state = await state.get_state()
    if current_state:
        await state.clear()
    await cmd_workers(message, session)


# ——— Просмотр мастеров (рабочих) ———
@router.message(Command("workers"))
async def cmd_workers(message: Message, session: AsyncSession) -> None:
    """Админ: список всех зарегистрированных мастеров (исполнителей)."""
    if not is_admin(message.from_user.id):
        await message.answer("Доступ только для администратора.")
        return
    # Можно: /workers — все, /workers active — только одобренные
    args = (message.text or "").strip().split()
    status_filter = args[1].lower() if len(args) > 1 else None  # active, pending_moderation, banned

    q = select(User).order_by(User.id)
    if status_filter in ("active", "pending_moderation", "banned"):
        q = q.where(User.status == status_filter)
    result = await session.execute(q)
    users = result.scalars().all()

    if not users:
        status_hint = f" со статусом «{status_filter}»" if status_filter else ""
        await message.answer(f"Мастеров{status_hint} пока нет.")
        return

    # Средний рейтинг по отзывам (to_user_id)
    result = await session.execute(
        select(Review.to_user_id, func.avg(Review.rating), func.count(Review.id))
        .group_by(Review.to_user_id)
    )
    ratings = {row[0]: (float(row[1]) if row[1] else 0, row[2]) for row in result.all()}

    lines = []
    status_emoji = {
        "active": "✅",
        "pending_moderation": "⏳",
        "banned": "❌",
    }
    for i, u in enumerate(users, 1):
        skills = ", ".join(u.skills[:3]) if u.skills else "—"
        if u.skills and len(u.skills) > 3:
            skills += "…"
        em = status_emoji.get(u.status, "•")
        rating_str = ""
        if u.id in ratings:
            avg_r, cnt_r = ratings[u.id]
            rating_str = f" | ★ {avg_r:.1f} ({cnt_r})"
        lines.append(
            f"{i}. {em} {u.full_name} | {u.city} | {skills} | {u.status}{rating_str}"
        )
    text = "📋 <b>Мастера (исполнители)</b>\n\n" + "\n".join(lines)
    if len(text) > 4000:
        text = text[:3990] + "\n\n… (обрезано, слишком много записей)"
    await message.answer(text)


# ——— Список тендеров (админ): /tenders [статус], пагинация ———
PAGE_SIZE = 5


@router.message(Command("tenders"))
async def cmd_tenders(message: Message, session: AsyncSession) -> None:
    """Админ: список тендеров с фильтром по статусу и пагинацией."""
    if not is_admin(message.from_user.id):
        await message.answer("Доступ только для администратора.")
        return
    args = (message.text or "").strip().split()
    status_filter = args[1].lower() if len(args) > 1 else None
    q = select(Tender).order_by(Tender.id.desc())
    if status_filter in ("draft", "open", "in_progress", "closed", "cancelled"):
        q = q.where(Tender.status == status_filter)
    result = await session.execute(q.limit(PAGE_SIZE + 1))
    tenders = result.scalars().all()
    has_more = len(tenders) > PAGE_SIZE
    if has_more:
        tenders = tenders[:PAGE_SIZE]
    if not tenders:
        await message.answer("Тендеров пока нет." + (f" Со статусом «{status_filter}»." if status_filter else ""))
        return
    lines = []
    for t in tenders:
        lines.append(f"#{t.id} {t.title} | {t.city} | {t.status}")
    text = "📋 <b>Тендеры</b>\n\n" + "\n".join(lines)
    buttons = []
    if has_more:
        buttons.append([
            InlineKeyboardButton(text="Далее", callback_data=f"tenders_page:{status_filter or 'all'}:{PAGE_SIZE}"),
        ])
    if buttons:
        await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))
    else:
        await message.answer(text)


@router.callback_query(F.data.startswith("tenders_page:"))
async def tenders_page_callback(callback: CallbackQuery, session: AsyncSession) -> None:
    """Пагинация списка тендеров."""
    if not is_admin(callback.from_user.id):
        await callback.answer("Доступ запрещён.", show_alert=True)
        return
    
    parts = parse_callback_parts(callback.data, "tenders_page:", expected_parts=2)
    if parts is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    
    status_filter = parts[0] if parts[0] != "all" else None
    try:
        offset = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else PAGE_SIZE
    except (ValueError, IndexError):
        offset = PAGE_SIZE
    q = select(Tender).order_by(Tender.id.desc()).offset(offset).limit(PAGE_SIZE + 1)
    if status_filter:
        q = q.where(Tender.status == status_filter)
    result = await session.execute(q)
    tenders = result.scalars().all()
    has_more = len(tenders) > PAGE_SIZE
    if has_more:
        tenders = tenders[:PAGE_SIZE]
    if not tenders:
        await callback.answer("Больше нет.")
        return
    lines = [f"#{t.id} {t.title} | {t.city} | {t.status}" for t in tenders]
    text = "📋 <b>Тендеры</b> (стр. " + str(offset // PAGE_SIZE + 1) + ")\n\n" + "\n".join(lines)
    buttons = []
    if has_more:
        buttons.append([
            InlineKeyboardButton(text="Далее", callback_data=f"tenders_page:{status_filter or 'all'}:{offset + PAGE_SIZE}"),
        ])
    await callback.message.edit_text(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None,
    )
    await callback.answer()


@router.message(F.text == "📊 Статистика")
async def cmd_stats_button(message: Message, session: AsyncSession, state: FSMContext) -> None:
    """Обработчик кнопки 'Статистика'."""
    # Отменяем FSM состояние, если оно активно
    current_state = await state.get_state()
    if current_state:
        await state.clear()
    await cmd_stats(message, session)


# ——— Статистика: /stats ———
@router.message(Command("stats"))
async def cmd_stats(message: Message, session: AsyncSession) -> None:
    """Админ: сводка по пользователям, тендерам, откликам."""
    if not is_admin(message.from_user.id):
        await message.answer("Доступ только для администратора.")
        return
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    # Пользователи по ролям и статусам
    result = await session.execute(
        select(User.role, User.status, func.count(User.id))
        .group_by(User.role, User.status)
    )
    role_status = result.all()
    result = await session.execute(select(func.count(User.id)))
    users_total = result.scalar() or 0
    # Тендеры по статусам
    result = await session.execute(
        select(Tender.status, func.count(Tender.id)).group_by(Tender.status)
    )
    tender_status = result.all()
    result = await session.execute(select(func.count(Tender.id)))
    tenders_total = result.scalar() or 0
    # Отклики за сегодня и за неделю
    result = await session.execute(
        select(func.count(TenderApplication.id)).where(TenderApplication.created_at >= today)
    )
    apps_today = result.scalar() or 0
    result = await session.execute(
        select(func.count(TenderApplication.id)).where(TenderApplication.created_at >= week_ago)
    )
    apps_week = result.scalar() or 0
    lines = [
        "<b>Статистика</b>",
        "",
        f"Пользователей: {users_total}",
    ]
    for r, s, c in role_status:
        lines.append(f"  — {r} / {s}: {c}")
    lines.extend(["", f"Тендеров: {tenders_total}"])
    for s, c in tender_status:
        lines.append(f"  — {s}: {c}")
    lines.extend([
        "",
        f"Откликов сегодня: {apps_today}",
        f"Откликов за неделю: {apps_week}",
    ])
    await message.answer("\n".join(lines))


# ——— Создание тендера через бот (FSM) ———
from handlers.keyboards import get_categories_kb, get_city_kb, get_tender_confirm_kb, get_fsm_nav_kb

@router.message(Command("add_tender"))
@router.message(F.text == "➕ Создать тендер")
async def cmd_add_tender(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    """Начало создания тендера (только для админа)."""
    if not is_admin(message.from_user.id):
        await message.answer("❌ Доступ только для администратора.")
        return
    current = await state.get_state()
    if current:
        await state.clear()
    await state.set_state(AddTenderStates.title)
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 1/6)\n\n"
        "Введите <b>название</b> тендера:",
        reply_markup=get_fsm_nav_kb(show_back=False),
    )


# --- Шаги FSM создания тендера ---

@router.message(AddTenderStates.title, F.text == "❌ Отменить")
@router.message(AddTenderStates.category, F.text == "❌ Отменить")
@router.message(AddTenderStates.city, F.text == "❌ Отменить")
@router.message(AddTenderStates.budget, F.text == "❌ Отменить")
@router.message(AddTenderStates.description, F.text == "❌ Отменить")
@router.message(AddTenderStates.deadline, F.text == "❌ Отменить")
async def tender_fsm_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    from handlers.keyboards import get_admin_menu_kb
    await message.answer("❌ Создание тендера отменено.", reply_markup=get_admin_menu_kb())


@router.message(AddTenderStates.category, F.text == "🔙 Назад")
async def tender_back_to_title(message: Message, state: FSMContext) -> None:
    await state.set_state(AddTenderStates.title)
    data = await state.get_data()
    prev = data.get("title", "")
    await message.answer(
        f"📋 <b>Создание тендера</b>  (шаг 1/6)\n\nВведите <b>название</b> тендера:"
        + (f"\n<i>Предыдущее: {prev}</i>" if prev else ""),
        reply_markup=get_fsm_nav_kb(show_back=False),
    )


@router.message(AddTenderStates.city, F.text == "🔙 Назад")
async def tender_back_to_category(message: Message, state: FSMContext) -> None:
    await state.set_state(AddTenderStates.category)
    data = await state.get_data()
    selected = data.get("categories") or []
    from aiogram.types import ReplyKeyboardRemove
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 2/6)\n\nВыберите <b>категории</b> (можно несколько), затем «Готово»:",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer("Категории:", reply_markup=get_categories_kb(selected))


@router.message(AddTenderStates.budget, F.text == "🔙 Назад")
async def tender_back_to_city(message: Message, state: FSMContext) -> None:
    await state.set_state(AddTenderStates.city)
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 3/6)\n\nВыберите <b>город</b>:",
        reply_markup=get_city_kb(),
    )


@router.message(AddTenderStates.description, F.text == "🔙 Назад")
async def tender_back_to_budget(message: Message, state: FSMContext) -> None:
    await state.set_state(AddTenderStates.budget)
    data = await state.get_data()
    prev = data.get("budget", "")
    await message.answer(
        f"📋 <b>Создание тендера</b>  (шаг 4/6)\n\nВведите <b>бюджет</b> (или «нет»):"
        + (f"\n<i>Предыдущее: {prev}</i>" if prev else ""),
        reply_markup=get_fsm_nav_kb(show_back=True),
    )


@router.message(AddTenderStates.deadline, F.text == "🔙 Назад")
async def tender_back_to_description(message: Message, state: FSMContext) -> None:
    await state.set_state(AddTenderStates.description)
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 5/6)\n\nВведите <b>описание</b> тендера:",
        reply_markup=get_fsm_nav_kb(show_back=True),
    )


# Шаг 1: Название
@router.message(AddTenderStates.title, F.text)
async def tender_step_title(message: Message, state: FSMContext) -> None:
    title = message.text.strip()
    if len(title) < 3 or len(title) > 256:
        await message.answer("❌ Название: от 3 до 256 символов. Попробуйте снова:")
        return
    await state.update_data(title=title)
    await state.set_state(AddTenderStates.category)
    from aiogram.types import ReplyKeyboardRemove
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 2/6)\n\n"
        "Выберите <b>категории</b> (можно несколько), затем «Готово»:",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer("Категории:", reply_markup=get_categories_kb())


# Шаг 2: Категории (inline callback, множественный выбор)
@router.callback_query(AddTenderStates.category, F.data.startswith("tcat:"))
async def tender_step_category(callback: CallbackQuery, state: FSMContext) -> None:
    payload = callback.data.replace("tcat:", "")
    data = await state.get_data()
    selected = list(data.get("categories") or [])

    if payload == "done":
        if not selected:
            await callback.answer("Выберите минимум одну категорию", show_alert=True)
            return
        await state.update_data(categories=selected)
        await state.set_state(AddTenderStates.city)
        await callback.message.edit_text(f"✅ Категории: {', '.join(selected)}")
        await callback.message.answer(
            "📋 <b>Создание тендера</b>  (шаг 3/6)\n\n"
            "Выберите <b>город</b>:",
            reply_markup=get_city_kb(),
        )
    else:
        if payload in selected:
            selected.remove(payload)
        else:
            selected.append(payload)
        await state.update_data(categories=selected)
        await callback.message.edit_reply_markup(reply_markup=get_categories_kb(selected))
    await callback.answer()


# Шаг 3: Город
@router.message(AddTenderStates.city, F.text)
async def tender_step_city(message: Message, state: FSMContext) -> None:
    city = message.text.strip()
    from config import settings
    if city not in settings.CITIES:
        await message.answer("❌ Выберите город из списка кнопок.")
        return
    await state.update_data(city=city)
    await state.set_state(AddTenderStates.budget)
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 4/6)\n\n"
        "Введите <b>бюджет</b> (например «100 000 тг» или «нет» если по договорённости):",
        reply_markup=get_fsm_nav_kb(show_back=True),
    )


# Шаг 4: Бюджет
@router.message(AddTenderStates.budget, F.text)
async def tender_step_budget(message: Message, state: FSMContext) -> None:
    raw = message.text.strip()
    budget = None if raw.lower() in ("нет", "-", "—", "0") else raw
    if budget and len(budget) > 128:
        await message.answer("❌ Бюджет: максимум 128 символов.")
        return
    await state.update_data(budget=budget)
    await state.set_state(AddTenderStates.description)
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 5/6)\n\n"
        "Введите <b>описание</b> тендера (подробности работы, требования):",
        reply_markup=get_fsm_nav_kb(show_back=True),
    )


# Шаг 5: Описание
@router.message(AddTenderStates.description, F.text)
async def tender_step_description(message: Message, state: FSMContext) -> None:
    desc = message.text.strip()
    if len(desc) < 10:
        await message.answer("❌ Описание слишком короткое (минимум 10 символов).")
        return
    await state.update_data(description=desc)
    await state.set_state(AddTenderStates.deadline)
    await message.answer(
        "📋 <b>Создание тендера</b>  (шаг 6/6)\n\n"
        "Введите <b>дедлайн</b> в формате ДД.ММ.ГГГГ ЧЧ:ММ\n"
        "(например <code>25.03.2026 18:00</code>)\n\n"
        "Или напишите «нет» если дедлайн не нужен.",
        reply_markup=get_fsm_nav_kb(show_back=True),
    )


# Шаг 6: Дедлайн → подтверждение
@router.message(AddTenderStates.deadline, F.text)
async def tender_step_deadline(message: Message, state: FSMContext) -> None:
    raw = message.text.strip()
    deadline = None
    if raw.lower() not in ("нет", "-", "—", "0", ""):
        from datetime import datetime
        try:
            # В БД дедлайны хранятся как naive UTC (TIMESTAMP WITHOUT TIME ZONE),
            # поэтому здесь тоже используем naive UTC.
            deadline = datetime.strptime(raw, "%d.%m.%Y %H:%M")
            if deadline < datetime.utcnow():
                await message.answer("❌ Дедлайн не может быть в прошлом. Введите корректную дату:")
                return
        except ValueError:
            await message.answer("❌ Неверный формат. Используйте ДД.ММ.ГГГГ ЧЧ:ММ или напишите «нет»:")
            return
    await state.update_data(deadline=deadline)
    await state.set_state(AddTenderStates.confirm)

    # Показ превью
    data = await state.get_data()
    dl_str = deadline.strftime("%d.%m.%Y %H:%M") if deadline else "нет"
    cats_str = ", ".join(data.get("categories") or [])
    preview = (
        "📋 <b>Предпросмотр тендера</b>\n\n"
        f"<b>Название:</b> {data['title']}\n"
        f"<b>Категории:</b> {cats_str}\n"
        f"<b>Город:</b> {data['city']}\n"
        f"<b>Бюджет:</b> {data.get('budget') or 'по договорённости'}\n"
        f"<b>Дедлайн:</b> {dl_str}\n\n"
        f"<b>Описание:</b>\n{data['description']}\n\n"
        "Выберите действие:"
    )
    from aiogram.types import ReplyKeyboardRemove
    await message.answer(preview, reply_markup=ReplyKeyboardRemove())
    await message.answer("Подтвердите:", reply_markup=get_tender_confirm_kb())


# Подтверждение: Опубликовать
@router.callback_query(AddTenderStates.confirm, F.data == "tender_pub")
async def tender_confirm_publish(
    callback: CallbackQuery,
    state: FSMContext,
    session: AsyncSession,
) -> None:
    data = await state.get_data()
    tender = Tender(
        title=data["title"],
        categories=data.get("categories") or [data.get("category")] or [],
        city=data["city"],
        budget=data.get("budget"),
        description=data["description"],
        deadline=data.get("deadline"),
        status=TenderStatus.OPEN.value,
        created_by_tg_id=callback.from_user.id,
    )
    # Привязка к user если есть
    result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
    user = result.scalar_one_or_none()
    if user:
        tender.created_by_user_id = user.id
    session.add(tender)
    await session.flush()
    await state.clear()

    await callback.message.edit_text(
        f"✅ <b>Тендер #{tender.id} опубликован!</b>\n\n"
        f"{data['title']} — {data['city']}"
    )

    # Рассылка исполнителям
    matched = await session.execute(
        select(User).where(
            User.status == UserStatus.ACTIVE.value,
            User.city == data["city"],
        )
    )
    cats = data.get("categories") or []
    users = [
        u for u in matched.scalars().all()
        if u.role in ("executor", "both")
        and (u.skills or [])
        and any(c in (u.skills or []) for c in cats)
    ]
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📩 Откликнуться", callback_data=f"apply:{tender.id}")]
    ])
    deadline_text = (
        data["deadline"].strftime("%d.%m.%Y %H:%M")
        if data.get("deadline")
        else "не указан"
    )
    sent = 0
    for u in users:
        try:
            await callback.bot.send_message(
                u.tg_id,
                f"📋 Новый тендер: <b>{data['title']}</b>\n"
                f"Город: {data['city']} | Бюджет: {data.get('budget') or 'договорная'}\n\n"
                f"⏰ Прием заявок до: {deadline_text}\n\n"
                f"{data['description'][:200]}\n\n"
                f"ℹ️ После дедлайна статус тендера может измениться автоматически.\n"
                f"📱 Подробнее можно посмотреть в приложении.",
                reply_markup=kb,
            )
            sent += 1
        except Exception as e:
            logger.warning(f"Failed to notify {u.tg_id}: {e}")

    from handlers.keyboards import get_admin_menu_kb
    await callback.message.answer(
        f"📨 Уведомления отправлены: {sent}/{len(users)} исполнителям.",
        reply_markup=get_admin_menu_kb(),
    )
    logger.info(f"Tender {tender.id} created and published via bot by {callback.from_user.id}")
    await callback.answer("Тендер опубликован!")


# Подтверждение: Сохранить черновик
@router.callback_query(AddTenderStates.confirm, F.data == "tender_draft")
async def tender_confirm_draft(
    callback: CallbackQuery,
    state: FSMContext,
    session: AsyncSession,
) -> None:
    data = await state.get_data()
    tender = Tender(
        title=data["title"],
        categories=data.get("categories") or [data.get("category")] or [],
        city=data["city"],
        budget=data.get("budget"),
        description=data["description"],
        deadline=data.get("deadline"),
        status=TenderStatus.DRAFT.value,
        created_by_tg_id=callback.from_user.id,
    )
    result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
    user = result.scalar_one_or_none()
    if user:
        tender.created_by_user_id = user.id
    session.add(tender)
    await session.flush()
    await state.clear()

    await callback.message.edit_text(
        f"📝 <b>Тендер #{tender.id} сохранён как черновик</b>\n\n"
        f"{data['title']} — {data['city']}\n\n"
        "Опубликовать можно через веб-админку или командой /tenders."
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📢 Опубликовать сейчас", callback_data=f"publish:{tender.id}")]
    ])
    from handlers.keyboards import get_admin_menu_kb
    await callback.message.answer("Действие:", reply_markup=kb)
    await callback.message.answer("🏠 Меню:", reply_markup=get_admin_menu_kb())
    logger.info(f"Tender {tender.id} saved as draft via bot by {callback.from_user.id}")
    await callback.answer("Черновик сохранён!")


# Подтверждение: Отменить
@router.callback_query(AddTenderStates.confirm, F.data == "tender_cancel")
async def tender_confirm_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("❌ Создание тендера отменено.")
    from handlers.keyboards import get_admin_menu_kb
    await callback.message.answer("🏠 Меню:", reply_markup=get_admin_menu_kb())
    await callback.answer("Отменено.")


@router.callback_query(F.data.startswith("publish:"))
async def publish_tender(
    callback: CallbackQuery,
    session: AsyncSession,
) -> None:
    """Опубликовать черновик тендера: статус open, рассылка исполнителям."""
    tender_id = parse_callback_id(callback.data, "publish:")
    if tender_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    result = await session.execute(
        select(Tender).where(Tender.id == tender_id, Tender.status == TenderStatus.DRAFT.value)
    )
    tender = result.scalar_one_or_none()
    if not tender:
        await callback.answer("Тендер не найден или уже опубликован.", show_alert=True)
        return
    # Только админ или создатель тендера
    if not is_admin(callback.from_user.id):
        result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
        user = result.scalar_one_or_none()
        if not user or user.id != tender.created_by_user_id:
            await callback.answer("Публиковать может только создатель или админ.", show_alert=True)
            return
    tender.status = TenderStatus.OPEN.value
    await session.flush()
    # Уведомляем только исполнителей: тот же город и навыки совпадают с категорией тендера
    result = await session.execute(
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
    tender_text = (
        f"📋 Тендер: {tender.title}\n"
        f"Категории: {', '.join(tender.categories or [])}\n"
        f"Город: {tender.city}\n"
        f"⏰ Прием заявок до: {tender.deadline.strftime('%d.%m.%Y %H:%M') if tender.deadline else 'не указан'}\n"
        f"Бюджет: {tender.budget or 'не указан'}\n\n"
        f"{tender.description}\n\n"
        f"ℹ️ После дедлайна статус тендера может измениться автоматически.\n"
        f"📱 Подробнее можно посмотреть в приложении."
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Откликнуться", callback_data=f"apply:{tender.id}")]
    ])
    sent_count = 0
    for u in users:
        try:
            await callback.bot.send_message(u.tg_id, tender_text, reply_markup=kb)
            sent_count += 1
        except Exception as e:
            logger.warning(f"Failed to send tender notification to user {u.tg_id}: {e}")
    logger.info(f"Tender {tender_id} published by {callback.from_user.id}, notifications sent to {sent_count}/{len(users)} users")
    await callback.message.edit_text(
        callback.message.text + f"\n\n✅ Опубликовано. Уведомления отправлены {sent_count} из {len(users)} исполнителям."
    )
    await callback.answer("Тендер опубликован.")


# ——— Выбор исполнителя по откликам ———
@router.callback_query(F.data.startswith("select_user:"))
async def admin_select_executor(
    callback: CallbackQuery,
    session: AsyncSession,
) -> None:
    """Выбор исполнителя: отклик selected без автосмены статуса тендера. Доступ: админ или создатель тендера."""
    app_id = parse_callback_id(callback.data, "select_user:")
    if app_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    result = await session.execute(
        select(TenderApplication)
        .options(
            selectinload(TenderApplication.user),
            selectinload(TenderApplication.tender),
        )
        .where(TenderApplication.id == app_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        await callback.answer("Отклик не найден.", show_alert=True)
        return
    tender = app.tender
    # Доступ: админ или создатель тендера
    if not is_admin(callback.from_user.id):
        result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
        user = result.scalar_one_or_none()
        if not user or user.id != tender.created_by_user_id:
            await callback.answer("Выбрать исполнителя может только создатель тендера или админ.", show_alert=True)
            return
    # Идемпотентность: повторный выбор уже selected отклика.
    if app.status == ApplicationStatus.SELECTED.value:
        await callback.answer("Этот исполнитель уже выбран.")
        return

    app.status = ApplicationStatus.SELECTED.value
    await session.flush()
    await callback.message.edit_text(
        callback.message.text + "\n\n✅ Исполнитель выбран."
    )
    
    # Уведомление в чат
    notification_text = (
        f"✅ <b>Вас выбрали исполнителем</b>\n\n"
        f"Заказ: «{tender.title}». С вами свяжутся для уточнения деталей."
    )
    await send_notification_with_menu_update(
        bot=callback.bot,
        user_tg_id=app.user.tg_id,
        message_text=notification_text,
        session=session,
        update_menu=True,
    )
    
    logger.info(f"Executor {app.user_id} selected for tender {tender.id} by {callback.from_user.id}")
    await callback.answer("Исполнитель выбран.")


# ——— Закрыть / Отменить тендер (админ или создатель) ———
@router.callback_query(F.data.startswith("close_tender:"))
async def close_tender_callback(
    callback: CallbackQuery,
    session: AsyncSession,
) -> None:
    tender_id = parse_callback_id(callback.data, "close_tender:")
    if tender_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    result = await session.execute(select(Tender).where(Tender.id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        await callback.answer("Тендер не найден.", show_alert=True)
        return
    if not is_admin(callback.from_user.id):
        result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
        user = result.scalar_one_or_none()
        if not user or user.id != tender.created_by_user_id:
            await callback.answer("Доступ только для создателя или админа.", show_alert=True)
            return
    tender.status = TenderStatus.CLOSED.value
    await session.flush()
    await callback.message.edit_text(
        (callback.message.text or "") + "\n\n✅ Тендер закрыт."
    )
    # Предложить создателю тендера оценить исполнителей (если есть выбранные отклики)
    result = await session.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.user))
        .where(
            TenderApplication.tender_id == tender.id,
            TenderApplication.status == ApplicationStatus.SELECTED.value,
        )
    )
    selected_apps = result.scalars().all()
    if selected_apps:
        # Уведомляем всех выбранных исполнителей о закрытии
        for selected_app in selected_apps:
            try:
                await callback.bot.send_message(
                    selected_app.user.tg_id,
                    f"✅ <b>Тендер завершён</b>\n\n"
                    f"Заказ «{tender.title}» закрыт. Спасибо за работу!\n"
                    f"Заказчик может оставить вам оценку.",
                )
            except Exception as e:
                logger.warning(f"Failed to notify executor {selected_app.user.tg_id} about close: {e}")

        # Предложить оценку создателю
        if tender.creator and tender.creator.tg_id:
            kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="⭐ Оценить исполнителей", callback_data=f"rate:{tender.id}")]
            ])
            try:
                await callback.bot.send_message(
                    tender.creator.tg_id,
                    f"Тендер «{tender.title}» закрыт. Оцените работу выбранных исполнителей.",
                    reply_markup=kb,
                )
            except Exception as e:
                logger.error(f"Failed to send close notification to creator {tender.creator.tg_id}: {e}")
    logger.info(f"Tender {tender_id} closed by {callback.from_user.id}")
    await callback.answer("Тендер закрыт.")


@router.callback_query(F.data.startswith("cancel_tender:"))
async def cancel_tender_callback(
    callback: CallbackQuery,
    session: AsyncSession,
) -> None:
    tender_id = parse_callback_id(callback.data, "cancel_tender:")
    if tender_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    result = await session.execute(select(Tender).where(Tender.id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        await callback.answer("Тендер не найден.", show_alert=True)
        return
    if not is_admin(callback.from_user.id):
        result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
        user = result.scalar_one_or_none()
        if not user or user.id != tender.created_by_user_id:
            await callback.answer("Доступ только для создателя или админа.", show_alert=True)
            return
    tender.status = TenderStatus.CANCELLED.value
    # Уведомляем всех откликнувшихся об отмене
    result = await session.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.user))
        .where(TenderApplication.tender_id == tender.id)
    )
    cancel_apps = result.scalars().all()
    for app_item in cancel_apps:
        try:
            await callback.bot.send_message(
                app_item.user.tg_id,
                f"❌ <b>Тендер отменён</b>\n\n"
                f"Заказ «{tender.title}» был отменён. "
                f"Вы можете откликнуться на другие заказы.",
            )
        except Exception as e:
            logger.warning(f"Failed to notify user {app_item.user.tg_id} about cancel: {e}")
    await session.flush()
    logger.info(f"Tender {tender_id} cancelled by {callback.from_user.id}, notified {len(cancel_apps)} applicants")
    await callback.message.edit_text(
        (callback.message.text or "") + "\n\n❌ Тендер отменён."
    )
    await callback.answer("Тендер отменён.")


# ——— Рейтинг исполнителя после закрытия тендера ———
@router.callback_query(F.data.startswith("rate:"))
async def rate_tender_start(
    callback: CallbackQuery,
    state: FSMContext,
    session: AsyncSession,
) -> None:
    """Начало оценки: только создатель тендера, выбор отклика для оценки."""
    tender_id = parse_callback_id(callback.data, "rate:")
    if tender_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    result = await session.execute(
        select(Tender)
        .options(selectinload(Tender.creator))
        .where(Tender.id == tender_id, Tender.status == TenderStatus.CLOSED.value)
    )
    tender = result.scalar_one_or_none()
    if not tender:
        await callback.answer("Тендер не найден.", show_alert=True)
        return
    result = await session.execute(
        select(User).where(User.tg_id == callback.from_user.id)
    )
    user = result.scalar_one_or_none()
    if not user or user.id != tender.created_by_user_id:
        await callback.answer("Оценить может только создатель тендера.", show_alert=True)
        return
    result = await session.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.user))
        .where(
            TenderApplication.tender_id == tender_id,
            TenderApplication.status == ApplicationStatus.SELECTED.value,
        )
    )
    apps = result.scalars().all()
    if not apps:
        await callback.answer("Нет выбранного исполнителя по этому тендеру.", show_alert=True)
        return

    # Показываем список выбранных исполнителей: оценка по каждому отдельно
    lines = [f"⭐ Оценка по тендеру «{tender.title}»", "", "Выберите исполнителя:"]
    buttons: list[list[InlineKeyboardButton]] = []
    for app in apps:
        result = await session.execute(select(Review).where(Review.application_id == app.id))
        rated = result.scalar_one_or_none() is not None
        mark = "✅" if rated else "📝"
        lines.append(f"{mark} {app.user.full_name}")
        if not rated:
            buttons.append([InlineKeyboardButton(text=f"Оценить: {app.user.full_name}", callback_data=f"rate_app:{app.id}")])

    await callback.message.edit_text("\n".join(lines))
    if buttons:
        kb = InlineKeyboardMarkup(inline_keyboard=buttons)
        await callback.message.answer("Кого оценить:", reply_markup=kb)
    else:
        await callback.message.answer("Все выбранные исполнители уже оценены.")
    await callback.answer()


@router.callback_query(F.data.startswith("rate_app:"))
async def rate_application_start(
    callback: CallbackQuery,
    state: FSMContext,
    session: AsyncSession,
) -> None:
    """Начало оценки конкретного отклика по application_id."""
    app_id = parse_callback_id(callback.data, "rate_app:")
    if app_id is None:
        await callback.answer("Ошибка обработки запроса.", show_alert=True)
        return
    result = await session.execute(
        select(TenderApplication)
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.user))
        .where(TenderApplication.id == app_id, TenderApplication.status == ApplicationStatus.SELECTED.value)
    )
    app = result.scalar_one_or_none()
    if not app or app.tender.status != TenderStatus.CLOSED.value:
        await callback.answer("Оценка доступна только для выбранных откликов закрытого тендера.", show_alert=True)
        return
    result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
    user = result.scalar_one_or_none()
    if not user or user.id != app.tender.created_by_user_id:
        await callback.answer("Оценить может только создатель тендера.", show_alert=True)
        return
    result = await session.execute(select(Review).where(Review.application_id == app.id))
    if result.scalar_one_or_none():
        await callback.answer("Этот исполнитель уже оценён по данному тендеру.", show_alert=True)
        return

    await state.update_data(
        application_id=app.id,
        tender_id=app.tender_id,
        to_user_id=app.user_id,
        from_user_id=user.id,
    )
    await state.set_state(ReviewStates.rating)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="1", callback_data="rating:1"), InlineKeyboardButton(text="2", callback_data="rating:2"),
         InlineKeyboardButton(text="3", callback_data="rating:3"), InlineKeyboardButton(text="4", callback_data="rating:4"),
         InlineKeyboardButton(text="5", callback_data="rating:5")],
    ])
    await callback.message.edit_text(
        f"Оцените исполнителя {app.user.full_name} по тендеру «{app.tender.title}» (1–5):"
    )
    await callback.message.answer("Выберите оценку:", reply_markup=kb)
    await callback.answer()


@router.callback_query(ReviewStates.rating, F.data.startswith("rating:"))
async def review_rating_callback(
    callback: CallbackQuery,
    state: FSMContext,
) -> None:
    rating = parse_callback_id(callback.data, "rating:")
    if rating is None or rating not in (1, 2, 3, 4, 5):
        await callback.answer("Выберите оценку от 1 до 5.", show_alert=True)
        return
    await state.update_data(rating=rating)
    await state.set_state(ReviewStates.comment)
    await callback.message.edit_text(f"Оценка: {rating}. Введите комментарий к отзыву или напишите «пропустить».")
    await callback.answer()


@router.message(ReviewStates.comment, F.text)
async def review_comment_submit(
    message: Message,
    state: FSMContext,
    session: AsyncSession,
) -> None:
    data = await state.get_data()
    comment = None if message.text.strip().lower() in ("пропустить", "нет", "—", "-") else message.text.strip()
    review = Review(
        tender_id=data["tender_id"],
        application_id=data["application_id"],
        from_user_id=data["from_user_id"],
        to_user_id=data["to_user_id"],
        rating=data["rating"],
        comment=comment,
    )
    session.add(review)
    await session.flush()
    await state.clear()
    # Уведомляем исполнителя
    result = await session.execute(select(User).where(User.id == data["to_user_id"]))
    to_user = result.scalar_one_or_none()
    if to_user:
        try:
            await message.bot.send_message(
                to_user.tg_id,
                f"Вам поставили оценку {data['rating']}/5 по тендеру."
                + (f" Комментарий: {comment}" if comment else ""),
            )
            logger.info(f"Review created for user {data['to_user_id']} by user {data['from_user_id']} for tender {data['tender_id']}")
        except Exception as e:
            logger.error(f"Failed to send review notification to user {to_user.tg_id}: {e}")
    await message.answer("Спасибо, ваш отзыв сохранён.")
