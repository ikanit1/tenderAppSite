"""updated_at columns

Revision ID: 006
Revises: 005
Create Date: 2026-02-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.add_column("tenders", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.add_column("tender_applications", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.add_column("reviews", sa.Column("updated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("reviews", "updated_at")
    op.drop_column("tender_applications", "updated_at")
    op.drop_column("tenders", "updated_at")
    op.drop_column("users", "updated_at")
