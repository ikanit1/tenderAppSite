"""Add index on support_messages.ticket_id

Revision ID: 010
Revises: 009
Create Date: 2026-03-16

"""
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("support_messages", schema=None) as batch_op:
        batch_op.create_index("ix_support_messages_ticket_id", ["ticket_id"])


def downgrade():
    with op.batch_alter_table("support_messages", schema=None) as batch_op:
        batch_op.drop_index("ix_support_messages_ticket_id")
