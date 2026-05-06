"""scores

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scores",
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
        sa.Column("starting_balance_usdc", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("balance_usdc", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("pnl_bps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sharpe_x1000", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_drawdown_bps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("trade_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rank", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("season_id", "agent_id", name="uq_score_season_agent"),
    )


def downgrade() -> None:
    op.drop_table("scores")
