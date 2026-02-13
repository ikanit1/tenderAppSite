# config.py — настройки приложения через pydantic-settings
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

# Файлы конфига в корне проекта: .envv (шаблон в репо), .env (секреты, переопределяет)
_ROOT_DIR = Path(__file__).resolve().parent
_ENV_FILES = (_ROOT_DIR / ".envv", _ROOT_DIR / ".env")

_ADMIN_ID_PLACEHOLDERS = ("ваш_telegram_id", "your_telegram_id")


class Settings(BaseSettings):
    """Конфигурация бота и БД из переменных окружения."""

    model_config = SettingsConfigDict(
        env_file=[str(f) for f in _ENV_FILES if f.exists()] or [str(_ENV_FILES[0])],
        env_file_encoding="utf-8",
    )

    # Telegram
    BOT_TOKEN: str = Field(..., description="Токен бота от @BotFather")
    ADMIN_ID: int = Field(..., description="Telegram ID администратора для модерации")

    @field_validator("ADMIN_ID", mode="before")
    @classmethod
    def parse_admin_id(cls, v):
        if isinstance(v, int):
            return v
        s = (v or "").strip().lower()
        if s in _ADMIN_ID_PLACEHOLDERS or not s.isdigit():
            raise ValueError(
                "Укажите в .env числовой Telegram ID: ADMIN_ID=123456789. "
                "Узнать свой ID: напишите боту @userinfobot в Telegram."
            )
        return int(v)

    # PostgreSQL
    DATABASE_URL: str = Field(
        ...,
        description="URL подключения к PostgreSQL (async). Пример: postgresql+asyncpg://user:pass@host:5432/db",
    )

    # Веб-админка (опционально)
    WEB_SECRET_KEY: str = Field(
        default="change-me-in-production",
        description="Секрет для сессий веб-админки",
    )
    ADMIN_USERNAME: str = Field(
        default="admin",
        description="Логин веб-админки (единственный учёт администратора)",
    )
    ADMIN_PASSWORD: str = Field(
        default="admin",
        description="Пароль входа в веб-админку",
    )
    BOT_USERNAME: str = Field(
        default="",
        description="Username бота без @ (для ссылки на лендинге, например TaskMasterBot)",
    )
    WEB_HOST: str = Field(default="0.0.0.0", description="Хост для веб-сервера")
    WEB_PORT: int = Field(default=8000, description="Порт веб-сервера")

    # Telegram Mini App (Web App) — базовый URL для кнопки «Открыть приложение»
    MINIAPP_BASE_URL: str = Field(
        default="http://localhost:8000",
        description="Публичный URL веб-сервера (для Mini App нужен HTTPS в продакшене)",
    )
    
    # Database Pool Settings
    DB_POOL_SIZE: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Размер пула соединений БД (минимум постоянных соединений)",
    )
    DB_MAX_OVERFLOW: int = Field(
        default=10,
        ge=0,
        le=50,
        description="Максимальное количество временных соединений сверх pool_size",
    )
    DB_POOL_RECYCLE: int = Field(
        default=3600,
        ge=60,
        description="Время жизни соединения в секундах перед переподключением",
    )
    DB_POOL_PRE_PING: bool = Field(
        default=True,
        description="Проверять соединение перед использованием",
    )
    
    # Cache Settings
    CACHE_TTL_USER_PROFILE: int = Field(
        default=300,
        ge=60,
        description="TTL кэша профиля пользователя в секундах",
    )
    CACHE_TTL_MENU: int = Field(
        default=60,
        ge=10,
        description="TTL кэша меню в секундах",
    )
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(
        default=10,
        ge=1,
        description="Количество запросов на период для rate limiting",
    )
    RATE_LIMIT_PERIOD: int = Field(
        default=60,
        ge=1,
        description="Период rate limiting в секундах",
    )

    # Tender automation settings
    TENDER_REMIND_BEFORE_HOURS: int = Field(
        default=24,
        ge=1,
        le=168,
        description="За сколько часов до дедлайна отправлять напоминание",
    )
    TENDER_SCHEDULER_INTERVAL_SECONDS: int = Field(
        default=30 * 60,
        ge=60,
        le=24 * 60 * 60,
        description="Интервал тика планировщика тендеров в секундах",
    )
    TENDER_NO_APPS_ALERT_HOURS: int = Field(
        default=12,
        ge=1,
        le=168,
        description="Через сколько часов без откликов сигнализировать админу/создателю",
    )

    # Документы при регистрации: разрешённые типы и размер
    ALLOWED_DOCUMENT_EXTENSIONS: list[str] = Field(
        default=[".pdf", ".jpg", ".jpeg", ".png"],
        description="Расширения файлов для модерации (документы исполнителя)",
    )
    ALLOWED_DOCUMENT_MIME_PREFIXES: list[str] = Field(
        default=["application/pdf", "image/jpeg", "image/png"],
        description="Префиксы MIME для проверки типа документа",
    )
    MAX_DOCUMENT_SIZE_MB: int = Field(
        default=20,
        ge=1,
        le=50,
        description="Максимальный размер файла при регистрации (МБ)",
    )

    @field_validator("WEB_SECRET_KEY", mode="after")
    @classmethod
    def check_web_secret(cls, v: str) -> str:
        if v == "change-me-in-production":
            import warnings
            warnings.warn(
                "WEB_SECRET_KEY is set to the default value. "
                "Change it in .env for production!",
                stacklevel=2,
            )
        return v

    @field_validator("ADMIN_PASSWORD", mode="after")
    @classmethod
    def check_admin_password(cls, v: str) -> str:
        if v == "admin":
            import warnings
            warnings.warn(
                "ADMIN_PASSWORD is set to the weak default 'admin'. "
                "Change it in .env for production!",
                stacklevel=2,
            )
        return v

    # Список доступных навыков (категорий тендеров)
    SKILL_TAGS: list[str] = Field(
        default=[
            "СКУД",
            "Видеонаблюдение",
            "АПС",
            "Электромонтаж",
            "Слаботочные системы",
            "Сетевое оборудование",
            "Видеоаналитика",
            "СКС",
            "ОПС",
            "IT (информационные технологии)",
        ],
        description="Теги навыков для выбора при регистрации и создания тендеров",
    )

    # Список городов для тендеров и регистрации
    CITIES: list[str] = Field(
        default=["Астана", "Караганда", "Семей"],
        description="Города для выбора при создании тендера и регистрации",
    )


settings = Settings()
