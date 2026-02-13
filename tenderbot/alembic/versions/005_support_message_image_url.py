"""support_messages.image_url

Revision ID: 005
Revises: 004
Create Date: 2026-02-05

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("support_messages", sa.Column("image_url", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("support_messages", "image_url")
