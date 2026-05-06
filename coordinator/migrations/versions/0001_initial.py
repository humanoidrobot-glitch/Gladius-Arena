"""initial — seasons table

Revision ID: 0001
Revises:
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("season_id_onchain", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("season_pda", sa.String(length=44), nullable=True, unique=True),
        sa.Column("authority", sa.String(length=44), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=256), nullable=False, server_default=""),
        sa.Column("trading_universe", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("max_agents", sa.Integer(), nullable=False),
        sa.Column("scoring_method", sa.String(length=16), nullable=False, server_default="risk_adjusted"),
        sa.Column("start_time", sa.BigInteger(), nullable=True),
        sa.Column("end_time", sa.BigInteger(), nullable=False),
        sa.Column("agent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("onchain_synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_seasons_season_id_onchain", "seasons", ["season_id_onchain"])
    op.create_index("ix_seasons_authority", "seasons", ["authority"])


def downgrade() -> None:
    op.drop_index("ix_seasons_authority", table_name="seasons")
    op.drop_index("ix_seasons_season_id_onchain", table_name="seasons")
    op.drop_table("seasons")
