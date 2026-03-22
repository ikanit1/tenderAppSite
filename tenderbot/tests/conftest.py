# tests/conftest.py — shared test fixtures
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Set test environment variables before importing config
os.environ.setdefault("BOT_TOKEN", "test:token")
os.environ.setdefault("ADMIN_ID", "123456789")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_db.db")
os.environ.setdefault("WEB_SECRET_KEY", "test-secret-key-for-testing")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin-password")

from database.models import Base


@pytest.fixture(scope="session")
def engine():
    """Create a test database engine."""
    _engine = create_engine("sqlite:///./test_db.db", echo=False)
    Base.metadata.create_all(bind=_engine)
    yield _engine
    Base.metadata.drop_all(bind=_engine)
    _engine.dispose()
    # Cleanup test db file
    try:
        os.remove("./test_db.db")
    except FileNotFoundError:
        pass


@pytest.fixture
def db(engine) -> Session:
    """Create a fresh database session for each test."""
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.rollback()
    session.close()
