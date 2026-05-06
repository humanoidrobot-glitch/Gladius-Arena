"""portfolio_snapshots

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "season_id",
            sa.Integer(),
            sa.ForeignKey("seasons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            sa.Integer(),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("total_value_usdc_micro", sa.BigInteger(), nullable=False),
        sa.Column("holdings_json", sa.JSON(), nullable=False),
        sa.Column("timestamp", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_portfolio_snapshots_season_agent_ts",
        "portfolio_snapshots",
        ["season_id", "agent_id", "timestamp"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_portfolio_snapshots_season_agent_ts", table_name="portfolio_snapshots"
    )
    op.drop_table("portfolio_snapshots")
