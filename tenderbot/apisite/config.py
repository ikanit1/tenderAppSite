"""Конфигурация приложения"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Загружаем .env из папки apisite (рядом с config.py)
load_dotenv(Path(__file__).resolve().parent / ".env")

# API настройки
B2B_API_URL = "https://complex.com.kz/index.php?route=api/b2b/products_json"
B2B_API_XML_URL = "https://complex.com.kz/index.php?route=api/b2b/download"
B2B_API_BASE_URL = "https://complex.com.kz"
API_KEY = os.getenv("API_KEY", "67b947f52e43a1fcd96cba842d77be0ce3fc3126f8c08310742b638b9b1f725f")

# Пути для изображений (возможные варианты)
IMAGE_PATHS = [
    "/image/catalog/products/",
    "/image/catalog/data/",  # Предсказуемый путь по бренду
    "/images/products/",
    "/catalog/products/",
    "/upload/products/",
]

# Google Custom Search API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyBtVMTD2scFSTxXyqTgGOZkjYttOxpGJcI")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID", "5198f2f4048814c52")

# Настройки скрейпинга
SCRAPING_ENABLED = os.getenv("SCRAPING_ENABLED", "true").lower() == "true"
SCRAPING_DELAY = float(os.getenv("SCRAPING_DELAY", "1.0"))  # Задержка между запросами

# Настройки обновления
UPDATE_INTERVAL_MINUTES = 10
CACHE_FILE = Path(__file__).parent / "data" / "products_cache.json"
XML_CACHE_FILE = Path(__file__).parent / "data" / "xml_cache.json"  # Опциональный локальный кэш XML
LOCAL_XML_FILE = Path(__file__).parent / "products.xml"  # Локальный XML файл в корне проекта

# Настройки парсера изображений
IMAGE_PARSER_ENABLED = os.getenv("IMAGE_PARSER_ENABLED", "true").lower() == "true"
IMAGE_PARSER_MAX_PAGES = int(os.getenv("IMAGE_PARSER_MAX_PAGES", "0"))  # 0 = все страницы, None = все
IMAGE_PARSER_STARTUP_DELAY = int(os.getenv("IMAGE_PARSER_STARTUP_DELAY", "30"))  # Задержка перед запуском (секунды)

# Настройки сервера
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8001))
UVICORN_WORKERS = int(os.getenv("UVICORN_WORKERS", "1"))  # Production: 2+

# CORS настройки
# Для production можно ограничить до конкретного домена: CORS_ORIGINS=https://grgroup.kz
# Для dev оставить пустым или указать * для разрешения всех источников
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# LLM API: приоритет у OpenAI, если задан OPENAI_API_KEY; иначе OpenRouter
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

# Отправка заказов на email админа (checkout)
ADMIN_EMAIL = os.getenv("info@grgroup.kz", "").strip()
SMTP_HOST = os.getenv("info@grgroup.kz", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("info@grgroup.kz", "").strip()
SMTP_PASSWORD = os.getenv("717^kkOs3", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "false").lower() == "true"

# Создаем директорию для данных
CACHE_FILE.parent.mkdir(exist_ok=True)
