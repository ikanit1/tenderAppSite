# handlers/keyboards.py — клавиатуры для удобного интерфейса
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder
from config import settings
from database.models import UserRole, UserStatus, TenderStatus

# URL Mini App для кнопки «Открыть приложение»
def get_miniapp_url() -> str:
    base = (settings.MINIAPP_BASE_URL or "").rstrip("/")
    return f"{base}/miniapp/" if base else ""


def get_open_app_inline_kb() -> InlineKeyboardMarkup | None:
    """Inline-кнопка «Открыть приложение» — при нажатии Telegram передаёт initData (в отличие от Reply Keyboard)."""
    url = get_miniapp_url()
    if not url:
        return None
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📱 Открыть приложение", web_app=WebAppInfo(url=url))],
    ])


def get_main_menu_kb(
    user_role: str | None = None,
    is_admin: bool = False,
    is_pending_moderation: bool = False,
    is_banned: bool = False,
) -> ReplyKeyboardMarkup:
    """Главное меню. Кнопка «Открыть приложение» ведёт в Mini App; уведомления приходят в чат."""
    builder = ReplyKeyboardBuilder()
    miniapp_url = get_miniapp_url()

    if is_banned:
        # Забаненный: поддержка + помощь (без тупика)
        builder.button(text="💬 Написать в поддержку")
        builder.button(text="ℹ️ Помощь")
        builder.adjust(1)
    elif is_pending_moderation:
        # На модерации: проверить статус + приложение + помощь
        builder.button(text="🔄 Проверить статус")
        if miniapp_url:
            builder.button(text="📱 Открыть приложение")
        if is_admin:
            builder.button(text="⚙️ Админ-панель")
        builder.button(text="ℹ️ Помощь")
        builder.adjust(2, 1)
    elif user_role == UserRole.EXECUTOR.value:
        if miniapp_url:
            builder.button(text="📱 Открыть приложение")
        builder.button(text="💬 Поддержка")
        if is_admin:
            builder.button(text="⚙️ Админ-панель")
        builder.button(text="ℹ️ Помощь")
        builder.adjust(2, 1)
    else:
        builder.button(text="📝 Пройти регистрацию")
        if miniapp_url:
            builder.button(text="📱 Открыть приложение")
        if is_admin:
            builder.button(text="⚙️ Админ-панель")
        builder.button(text="ℹ️ Помощь")
        builder.adjust(2, 1)
    return builder.as_markup(
        resize_keyboard=True,
        is_persistent=True,
        one_time_keyboard=False,
    )


def get_fsm_nav_kb(show_back: bool = True) -> ReplyKeyboardMarkup:
    """Reply-клавиатура навигации для FSM шагов: Назад + Отменить."""
    builder = ReplyKeyboardBuilder()
    if show_back:
        builder.button(text="🔙 Назад")
    builder.button(text="❌ Отменить")
    builder.adjust(2)
    return builder.as_markup(resize_keyboard=True, one_time_keyboard=False)


def get_admin_menu_kb() -> ReplyKeyboardMarkup:
    """Меню для администратора."""
    builder = ReplyKeyboardBuilder()
    builder.button(text="👥 Модерация")
    builder.button(text="➕ Создать тендер")
    builder.button(text="👷 Рабочие")
    builder.button(text="📊 Статистика")
    builder.button(text="🏠 Главное меню")
    builder.adjust(2, 2, 1)
    return builder.as_markup(
        resize_keyboard=True,
        is_persistent=True,
        one_time_keyboard=False,
    )


def get_category_kb() -> InlineKeyboardMarkup:
    """Inline-клавиатура выбора одной категории (legacy)."""
    builder = InlineKeyboardBuilder()
    for tag in settings.SKILL_TAGS:
        builder.button(text=tag, callback_data=f"tcat:{tag}")
    builder.adjust(2)
    return builder.as_markup()


def get_categories_kb(selected: list[str] | None = None) -> InlineKeyboardMarkup:
    """Inline-клавиатура множественного выбора категорий тендера."""
    selected = selected or []
    builder = InlineKeyboardBuilder()
    for tag in settings.SKILL_TAGS:
        prefix = "✅ " if tag in selected else ""
        builder.button(text=f"{prefix}{tag}", callback_data=f"tcat:{tag}")
    builder.button(text="✅ Готово, дальше", callback_data="tcat:done")
    builder.adjust(2)
    return builder.as_markup()


def get_city_kb() -> ReplyKeyboardMarkup:
    """Reply-клавиатура выбора города из CITIES (с кнопками Назад и Отменить)."""
    builder = ReplyKeyboardBuilder()
    for city in settings.CITIES:
        builder.button(text=city)
    builder.button(text="🔙 Назад")
    builder.button(text="❌ Отменить")
    builder.adjust(1, 2)
    return builder.as_markup(resize_keyboard=True, one_time_keyboard=False)


def get_tender_confirm_kb() -> InlineKeyboardMarkup:
    """Клавиатура подтверждения создания тендера."""
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Опубликовать", callback_data="tender_pub")
    builder.button(text="📝 Сохранить черновик", callback_data="tender_draft")
    builder.button(text="❌ Отменить", callback_data="tender_cancel")
    builder.adjust(2, 1)
    return builder.as_markup()




def get_skills_kb(selected_skills: list[str] | None = None) -> InlineKeyboardMarkup:
    """Клавиатура выбора навыков."""
    selected_skills = selected_skills or []
    builder = InlineKeyboardBuilder()
    
    for tag in settings.SKILL_TAGS:
        prefix = "✅ " if tag in selected_skills else ""
        builder.button(
            text=f"{prefix}{tag}",
            callback_data=f"skill:{tag}"
        )
    
    builder.button(
        text="✅ Готово, дальше",
        callback_data="skill:done"
    )
    builder.adjust(2)
    return builder.as_markup()


def get_moderation_kb(user_id: int) -> InlineKeyboardMarkup:
    """Клавиатура для модерации пользователя."""
    builder = InlineKeyboardBuilder()
    builder.button(
        text="✅ Одобрить",
        callback_data=f"mod_approve:{user_id}"
    )
    builder.button(
        text="❌ Отклонить",
        callback_data=f"mod_reject:{user_id}"
    )
    builder.button(
        text="👁️ Просмотр профиля",
        callback_data=f"mod_view:{user_id}"
    )
    builder.adjust(2, 1)
    return builder.as_markup()


def get_tender_actions_kb(tender_id: int, status: str) -> InlineKeyboardMarkup:
    """Клавиатура действий с тендером."""
    builder = InlineKeyboardBuilder()
    
    if status == TenderStatus.DRAFT.value:
        builder.button(
            text="📢 Опубликовать",
            callback_data=f"publish:{tender_id}"
        )
        builder.button(
            text="✏️ Редактировать",
            callback_data=f"edit_tender:{tender_id}"
        )
    elif status == TenderStatus.OPEN.value:
        builder.button(
            text="👁️ Просмотр откликов",
            callback_data=f"view_apps:{tender_id}"
        )
        builder.button(
            text="🔒 Закрыть",
            callback_data=f"close_tender:{tender_id}"
        )
        builder.button(
            text="❌ Отменить",
            callback_data=f"cancel_tender:{tender_id}"
        )
    elif status == TenderStatus.IN_PROGRESS.value:
        builder.button(
            text="👁️ Просмотр откликов",
            callback_data=f"view_apps:{tender_id}"
        )
        builder.button(
            text="✅ Завершить",
            callback_data=f"complete_tender:{tender_id}"
        )
    
    builder.adjust(2, 1)
    return builder.as_markup()


def get_tender_list_kb(tender_id: int, can_apply: bool = True) -> InlineKeyboardMarkup:
    """Клавиатура для списка тендеров."""
    builder = InlineKeyboardBuilder()
    
    if can_apply:
        builder.button(
            text="📩 Откликнуться на заказ",
            callback_data=f"apply:{tender_id}"
        )
    
    builder.button(
        text="👁️ Подробнее о заказе",
        callback_data=f"tender_detail:{tender_id}"
    )
    builder.adjust(1)
    return builder.as_markup()


def get_pagination_kb(
    page: int,
    total_pages: int,
    prefix: str,
    item_id: int | None = None
) -> InlineKeyboardMarkup:
    """Клавиатура пагинации."""
    builder = InlineKeyboardBuilder()
    
    if page > 1:
        builder.button(
            text="◀️ Назад",
            callback_data=f"{prefix}_page:{page - 1}"
        )
    
    builder.button(
        text=f"📄 {page}/{total_pages}",
        callback_data="page_info"
    )
    
    if page < total_pages:
        builder.button(
            text="Вперёд ▶️",
            callback_data=f"{prefix}_page:{page + 1}"
        )
    
    builder.adjust(3)
    return builder.as_markup()


def get_application_actions_kb(application_id: int, tender_id: int) -> InlineKeyboardMarkup:
    """Клавиатура действий с откликом."""
    builder = InlineKeyboardBuilder()
    builder.button(
        text="✅ Выбрать исполнителя",
        callback_data=f"select_user:{application_id}"
    )
    builder.button(
        text="❌ Отклонить",
        callback_data=f"reject_app:{application_id}"
    )
    builder.button(
        text="👁️ Профиль исполнителя",
        callback_data=f"user_profile:{application_id}"
    )
    builder.button(
        text="📋 К тендеру",
        callback_data=f"tender_detail:{tender_id}"
    )
    builder.adjust(2, 1, 1)
    return builder.as_markup()


def get_application_detail_kb(application_id: int, tender_id: int) -> InlineKeyboardMarkup:
    """Клавиатура для детального просмотра отклика пользователем."""
    builder = InlineKeyboardBuilder()
    builder.button(
        text="👁️ Подробнее о тендере",
        callback_data=f"tender_detail:{tender_id}"
    )
    builder.button(
        text="📋 К списку откликов",
        callback_data="my_applications"
    )
    builder.adjust(1)
    return builder.as_markup()


def get_profile_edit_kb() -> InlineKeyboardMarkup:
    """Клавиатура редактирования профиля."""
    builder = InlineKeyboardBuilder()
    builder.button(text="✏️ Изменить профиль", callback_data="edit_profile")
    builder.button(text="📋 Мои отклики", callback_data="my_applications")
    builder.adjust(1)
    return builder.as_markup()


def get_support_chat_kb() -> InlineKeyboardMarkup:
    """Клавиатура в чате поддержки: завершить чат."""
    builder = InlineKeyboardBuilder()
    builder.button(text="🔚 Закончить обращение", callback_data="support_end_chat")
    return builder.as_markup()


def get_help_kb() -> InlineKeyboardMarkup:
    """Клавиатура помощи."""
    builder = InlineKeyboardBuilder()
    builder.button(text="📖 Список команд", callback_data="help_commands")
    builder.button(text="❓ Частые вопросы", callback_data="help_faq")
    builder.button(text="💬 В поддержку", callback_data="help_support")
    builder.adjust(1)
    return builder.as_markup()

