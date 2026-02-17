# web/database.py — синхронная сессия БД для веб-админки (та же БД, что и бот)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from config import settings
from database.models import Base, User, Tender, TenderApplication, Review

# Синхронный URL (без asyncpg/aiosqlite)
_db_url = settings.DATABASE_URL
if "+asyncpg" in _db_url:
    _db_url = _db_url.replace("+asyncpg", "")
if "+aiosqlite" in _db_url:
    _db_url = _db_url.replace("+aiosqlite", "")

# Настройка пула соединений для синхронного движка
if "sqlite" in _db_url:
    from sqlalchemy import event
    engine = create_engine(
        _db_url,
        echo=False,
        pool_pre_ping=False,  # SQLite не поддерживает
        connect_args={"check_same_thread": False},
    )
    # Включить foreign keys для SQLite (критично для ON DELETE CASCADE)
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(
        _db_url,
        echo=False,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=settings.DB_POOL_PRE_PING,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
