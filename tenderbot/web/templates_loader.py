# web/templates_loader.py — Единый загрузчик шаблонов с фильтрами
from pathlib import Path
from fastapi.templating import Jinja2Templates
from web.utils.translations import (
    translate_status, translate_role, translate_field,
    humanize_status, humanize_role, format_datetime, format_date,
)

# Создаем единый экземпляр Jinja2Templates
templates = Jinja2Templates(directory=Path(__file__).parent / "templates")
# Включаем autoescape для безопасности
templates.env.autoescape = True

# Регистрируем фильтры для перевода
templates.env.filters["translate_status"] = translate_status
templates.env.filters["translate_role"] = translate_role
templates.env.filters["translate_field"] = translate_field
templates.env.filters["humanize_status"] = humanize_status
templates.env.filters["humanize_role"] = humanize_role
templates.env.filters["format_datetime"] = format_datetime
templates.env.filters["format_date"] = format_date


def csrf_hidden_input(request) -> str:
    """Generate an HTML hidden input with CSRF token."""
    from web.utils.csrf import generate_csrf_token
    token = generate_csrf_token(request)
    return f'<input type="hidden" name="csrf_token" value="{token}">'


# Register global functions for templates
templates.env.globals["csrf_hidden_input"] = csrf_hidden_input
