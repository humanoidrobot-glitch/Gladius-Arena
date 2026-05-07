"""agents.avatar_glb_url

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("avatar_glb_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agents", "avatar_glb_url")
