"""Tender category -> categories (JSON list)

Revision ID: 009
Revises: 008
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.sqlite import JSON

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.add_column(sa.Column("categories", sa.JSON(), nullable=True))
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE tenders SET categories = json_array(category) WHERE category IS NOT NULL")
    )
    conn.execute(
        sa.text("UPDATE tenders SET categories = '[]' WHERE category IS NULL")
    )
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.drop_index("ix_tenders_category")
        batch_op.drop_column("category")


def downgrade():
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.add_column(sa.Column("category", sa.String(128), nullable=True))
    # Migrate back: take first element of categories
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE tenders SET category = json_extract(categories, '$[0]') WHERE categories IS NOT NULL")
    )
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.alter_column("category", nullable=False)
        batch_op.create_index("ix_tenders_category", ["category"])
        batch_op.drop_column("categories")
