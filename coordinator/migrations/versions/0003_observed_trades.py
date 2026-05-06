"""observed_trades

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "observed_trades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("season_id", sa.Integer(), sa.ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tx_signature", sa.String(length=88), nullable=False),
        sa.Column("slot", sa.BigInteger(), nullable=False),
        sa.Column("timestamp", sa.BigInteger(), nullable=False),
        sa.Column("token_in_mint", sa.String(length=44), nullable=False),
        sa.Column("token_out_mint", sa.String(length=44), nullable=False),
        sa.Column("amount_in_raw", sa.String(length=64), nullable=False),
        sa.Column("amount_out_raw", sa.String(length=64), nullable=False),
        sa.Column("in_universe", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("raw_helius_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("season_id", "agent_id", "tx_signature", name="uq_trade_dedupe"),
    )
    op.create_index("ix_observed_trades_tx_signature", "observed_trades", ["tx_signature"])
    op.create_index("ix_observed_trades_season_agent", "observed_trades", ["season_id", "agent_id"])


def downgrade() -> None:
    op.drop_index("ix_observed_trades_season_agent", table_name="observed_trades")
    op.drop_index("ix_observed_trades_tx_signature", table_name="observed_trades")
    op.drop_table("observed_trades")
