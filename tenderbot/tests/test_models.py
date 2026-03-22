# tests/test_models.py — tests for database models
import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from database.models import (
    User, Tender, TenderApplication, Review,
    UserStatus, UserRole, TenderStatus, ApplicationStatus,
    SupportTicket, SupportMessage, TicketStatus,
)


class TestUserModel:
    def test_create_user(self, db):
        user = User(
            tg_id=100001,
            full_name="Test User",
            city="Астана",
            phone="+77001234567",
            role=UserRole.EXECUTOR.value,
            status=UserStatus.ACTIVE.value,
        )
        db.add(user)
        db.flush()
        assert user.id is not None
        assert user.tg_id == 100001

    def test_unique_tg_id(self, db):
        user1 = User(tg_id=100002, full_name="A", city="Астана", phone="+1")
        user2 = User(tg_id=100002, full_name="B", city="Караганда", phone="+2")
        db.add(user1)
        db.flush()
        db.add(user2)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_user_status_enum(self):
        assert UserStatus.PENDING_MODERATION.value == "pending_moderation"
        assert UserStatus.ACTIVE.value == "active"
        assert UserStatus.BANNED.value == "banned"


class TestTenderModel:
    def test_create_tender(self, db):
        tender = Tender(
            title="Test Tender",
            categories=["СКУД"],
            city="Астана",
            description="Test description",
            status=TenderStatus.DRAFT.value,
        )
        db.add(tender)
        db.flush()
        assert tender.id is not None

    def test_tender_status_enum(self):
        assert TenderStatus.DRAFT.value == "draft"
        assert TenderStatus.OPEN.value == "open"
        assert TenderStatus.IN_PROGRESS.value == "in_progress"
        assert TenderStatus.CLOSED.value == "closed"


class TestApplicationModel:
    def test_create_application(self, db):
        user = User(tg_id=200001, full_name="App User", city="Астана", phone="+1")
        tender = Tender(title="T", categories=["C"], city="Астана", description="D")
        db.add_all([user, tender])
        db.flush()

        app = TenderApplication(
            tender_id=tender.id,
            user_id=user.id,
            status=ApplicationStatus.APPLIED.value,
        )
        db.add(app)
        db.flush()
        assert app.id is not None

    def test_unique_application_constraint(self, db):
        user = User(tg_id=200002, full_name="U", city="Астана", phone="+1")
        tender = Tender(title="T", categories=["C"], city="Астана", description="D")
        db.add_all([user, tender])
        db.flush()

        app1 = TenderApplication(tender_id=tender.id, user_id=user.id)
        db.add(app1)
        db.flush()

        app2 = TenderApplication(tender_id=tender.id, user_id=user.id)
        db.add(app2)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_application_status_enum(self):
        assert ApplicationStatus.APPLIED.value == "applied"
        assert ApplicationStatus.SELECTED.value == "selected"
        assert ApplicationStatus.REJECTED.value == "rejected"


class TestPagination:
    def test_page_info(self):
        from web.utils.pagination import get_page_info

        info = get_page_info(1, 10, 100)
        assert info.page == 1
        assert info.total_pages == 10
        assert info.has_next is True
        assert info.has_prev is False

    def test_page_info_last_page(self):
        from web.utils.pagination import get_page_info

        info = get_page_info(5, 10, 50)
        assert info.page == 5
        assert info.has_next is False
        assert info.has_prev is True

    def test_page_info_empty(self):
        from web.utils.pagination import get_page_info

        info = get_page_info(1, 10, 0)
        assert info.total_pages == 1
        assert info.has_next is False
