"""agents + season_entries

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("wallet_pubkey", sa.String(length=44), nullable=False, unique=True),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("metadata_uri", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("three_ws_agent_id", sa.String(length=44), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agents_wallet_pubkey", "agents", ["wallet_pubkey"])

    op.create_table(
        "season_entries",
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
        sa.Column("helius_webhook_id", sa.String(length=64), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("season_id", "agent_id", name="uq_season_agent"),
    )
    op.create_index("ix_season_entries_season_id", "season_entries", ["season_id"])
    op.create_index("ix_season_entries_agent_id", "season_entries", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_season_entries_agent_id", table_name="season_entries")
    op.drop_index("ix_season_entries_season_id", table_name="season_entries")
    op.drop_table("season_entries")
    op.drop_index("ix_agents_wallet_pubkey", table_name="agents")
    op.drop_table("agents")
