# utils/fsm_clear.py — сброс FSM состояния пользователя (при бане и т.п.)
"""Диспетчер задаётся из main.py; хендлеры могут вызывать clear_user_fsm(bot, user_tg_id)."""
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from aiogram import Bot
    from aiogram import Dispatcher

logger = logging.getLogger(__name__)
_dispatcher: "Dispatcher | None" = None


def set_dispatcher(dp: "Dispatcher") -> None:
    global _dispatcher
    _dispatcher = dp


async def clear_user_fsm(bot: "Bot", user_tg_id: int) -> None:
    """Сбрасывает FSM-состояние пользователя (например, при бане). В личном чате chat_id = user_tg_id."""
    if _dispatcher is None:
        return
    try:
        fsm = getattr(_dispatcher, "fsm", None)
        if fsm is not None and hasattr(fsm, "get_context"):
            ctx = await fsm.get_context(
                bot=bot,
                chat_id=user_tg_id,
                user_id=user_tg_id,
            )
            await ctx.clear()
            logger.info("FSM state cleared for user_id=%s", user_tg_id)
    except Exception as e:
        logger.warning("clear_user_fsm failed for user_id=%s: %s", user_tg_id, e)
