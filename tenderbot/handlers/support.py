# handlers/support.py — тикеты поддержки
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from aiogram import F, Router
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from config import settings
from database.models import User, UserStatus, SupportTicket, SupportMessage, TicketStatus
from states.support import SupportStates
from handlers.keyboards import get_main_menu_kb, get_support_chat_kb
from utils.chat_utils import answer_with_cleanup, cleanup_old_messages, track_bot_message, track_user_message

router = Router()


async def _get_or_create_open_ticket(session: AsyncSession, user_id: int) -> SupportTicket | None:
    """Найти открытый тикет пользователя или создать новый."""
    result = await session.execute(
        select(SupportTicket)
        .where(
            SupportTicket.user_id == user_id,
            SupportTicket.status != TicketStatus.CLOSED.value,
        )
        .order_by(SupportTicket.id.desc())
        .limit(1)
    )
    ticket = result.scalar_one_or_none()
    if ticket:
        return ticket
    ticket = SupportTicket(user_id=user_id, status=TicketStatus.NEW.value)
    session.add(ticket)
    await session.flush()
    return ticket


async def _start_bot_support_chat(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
    user: User,
) -> None:
    """Запустить чат поддержки прямо в боте (fallback для banned / недоступного Mini App)."""
    ticket = await _get_or_create_open_ticket(session, user.id)
    if not ticket:
        await message.answer("Не удалось создать тикет. Попробуйте позже.")
        return
    await state.set_state(SupportStates.active_chat)
    await state.update_data(support_ticket_id=ticket.id)
    await message.answer(
        "💬 <b>Чат поддержки</b>\n\n"
        "Опишите вашу проблему — администратор ответит в ближайшее время.\n\n"
        "Для завершения нажмите кнопку ниже.",
        reply_markup=get_support_chat_kb(),
    )


@router.message(F.text == "💬 Написать в поддержку")
async def cmd_support_direct(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    """Поддержка через бот напрямую (для забаненных и при недоступности Mini App)."""
    result = await session.execute(select(User).where(User.tg_id == message.from_user.id))
    user = result.scalar_one_or_none()
    if not user:
        is_admin = message.from_user.id == settings.ADMIN_ID
        await answer_with_cleanup(
            message,
            "❌ Сначала пройдите регистрацию.",
            reply_markup=get_main_menu_kb(None, is_admin),
        )
        return
    await _start_bot_support_chat(message, session, state, user)


@router.message(F.text == "💬 Поддержка")
async def cmd_support(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    """Поддержка: Mini App если доступен, иначе чат в боте."""
    result = await session.execute(select(User).where(User.tg_id == message.from_user.id))
    user = result.scalar_one_or_none()
    is_admin = message.from_user.id == settings.ADMIN_ID
    if not user:
        await answer_with_cleanup(
            message,
            "❌ Сначала пройдите регистрацию.",
            reply_markup=get_main_menu_kb(None, is_admin),
        )
        return
    if user.status == UserStatus.PENDING_MODERATION.value:
        await answer_with_cleanup(
            message,
            "⏳ Доступ к поддержке будет после одобрения модерации.",
            reply_markup=get_main_menu_kb(user.role, is_admin, is_pending_moderation=True),
        )
        return
    if user.status == UserStatus.BANNED.value:
        # Забаненный пользователь — чат поддержки прямо в боте
        await _start_bot_support_chat(message, session, state, user)
        return

    # Для активных: Mini App если настроен, иначе fallback в бот
    from handlers.keyboards import get_miniapp_url
    if get_miniapp_url():
        await answer_with_cleanup(
            message,
            "💬 <b>Поддержка</b>\n\n"
            "Чат с поддержкой — в приложении. Откройте приложение и выберите вкладку «Поддержка».",
            reply_markup=get_main_menu_kb(user.role, is_admin, is_pending_moderation=False),
        )
    else:
        # Mini App не настроен — fallback в бот
        await _start_bot_support_chat(message, session, state, user)


@router.message(SupportStates.active_chat, F.text)
async def support_message(
    message: Message,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    """Сообщение пользователя в чате поддержки: сохраняем в БД (видят в веб-админке)."""
    data = await state.get_data()
    ticket_id = data.get("support_ticket_id")
    if not ticket_id:
        await state.clear()
        await message.answer("Сессия чата истекла. Нажмите «💬 Поддержка» снова.")
        return

    result = await session.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket or ticket.status == TicketStatus.CLOSED.value:
        await state.clear()
        await message.answer("Тикет закрыт. Нажмите «💬 Поддержка» для нового обращения.")
        return

    msg = SupportMessage(ticket_id=ticket_id, author="user", text=message.text.strip())
    session.add(msg)
    if ticket.status == TicketStatus.NEW.value:
        ticket.status = TicketStatus.IN_PROGRESS.value
    await session.flush()

    # Очистка старых сообщений в чате
    await track_user_message(message.chat.id, message.message_id)
    await cleanup_old_messages(message.bot, message.chat.id, keep_last=3)

    sent = await message.answer(
        "✅ Сообщение передано в поддержку. Ожидайте ответа.",
        reply_markup=get_support_chat_kb(),
    )
    await track_bot_message(message.chat.id, sent.message_id)


@router.callback_query(SupportStates.active_chat, F.data == "support_end_chat")
@router.callback_query(F.data == "support_end_chat")
async def support_end_chat(
    callback: CallbackQuery,
    session: AsyncSession,
    state: FSMContext,
) -> None:
    """Завершить чат: закрыть тикет, сбросить состояние."""
    await callback.answer()
    data = await state.get_data()
    ticket_id = data.get("support_ticket_id")
    if ticket_id:
        result = await session.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if ticket:
            ticket.status = TicketStatus.CLOSED.value

    await state.clear()

    result = await session.execute(select(User).where(User.tg_id == callback.from_user.id))
    user = result.scalar_one_or_none()
    is_admin = callback.from_user.id == settings.ADMIN_ID
    reply_markup = get_main_menu_kb(
        user.role if user else None,
        is_admin,
        is_pending_moderation=user and user.status == UserStatus.PENDING_MODERATION.value,
    )

    if callback.message:
        await callback.message.edit_text(
            "🔚 Чат поддержки завершён. Если появятся вопросы — нажмите «💬 Поддержка» снова."
        )
        await callback.message.answer("🏠 Главное меню", reply_markup=reply_markup)
