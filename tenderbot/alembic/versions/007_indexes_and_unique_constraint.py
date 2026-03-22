"""Add indexes and unique constraint for tender_applications

Revision ID: 007
Revises: 006
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    # Add indexes for frequently queried columns
    with op.batch_alter_table("users", schema=None) as batch_op:
        # tg_id already has unique=True which creates an index
        batch_op.create_index("ix_users_status", ["status"])
        batch_op.create_index("ix_users_role", ["role"])
        batch_op.create_index("ix_users_city", ["city"])

    with op.batch_alter_table("tenders", schema=None) as batch_op:
        batch_op.create_index("ix_tenders_status", ["status"])
        batch_op.create_index("ix_tenders_city", ["city"])
        batch_op.create_index("ix_tenders_category", ["category"])

    with op.batch_alter_table("tender_applications", schema=None) as batch_op:
        batch_op.create_index("ix_tender_applications_tender_id", ["tender_id"])
        batch_op.create_index("ix_tender_applications_user_id", ["user_id"])
        batch_op.create_index("ix_tender_applications_status", ["status"])
        # Unique constraint to prevent duplicate applications
        batch_op.create_unique_constraint("uq_tender_user", ["tender_id", "user_id"])

    with op.batch_alter_table("support_tickets", schema=None) as batch_op:
        batch_op.create_index("ix_support_tickets_user_id", ["user_id"])
        batch_op.create_index("ix_support_tickets_status", ["status"])


def downgrade():
    with op.batch_alter_table("support_tickets", schema=None) as batch_op:
        batch_op.drop_index("ix_support_tickets_status")
        batch_op.drop_index("ix_support_tickets_user_id")

    with op.batch_alter_table("tender_applications", schema=None) as batch_op:
        batch_op.drop_constraint("uq_tender_user", type_="unique")
        batch_op.drop_index("ix_tender_applications_status")
        batch_op.drop_index("ix_tender_applications_user_id")
        batch_op.drop_index("ix_tender_applications_tender_id")

    with op.batch_alter_table("tenders", schema=None) as batch_op:
        batch_op.drop_index("ix_tenders_category")
        batch_op.drop_index("ix_tenders_city")
        batch_op.drop_index("ix_tenders_status")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index("ix_users_city")
        batch_op.drop_index("ix_users_role")
        batch_op.drop_index("ix_users_status")
