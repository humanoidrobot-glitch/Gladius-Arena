from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ObservedTrade(Base):
    __tablename__ = "observed_trades"
    __table_args__ = (
        UniqueConstraint("season_id", "agent_id", "tx_signature", name="uq_trade_dedupe"),
        Index("ix_observed_trades_season_agent", "season_id", "agent_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id", ondelete="CASCADE"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    tx_signature: Mapped[str] = mapped_column(String(88), index=True)
    slot: Mapped[int] = mapped_column(BigInteger)
    timestamp: Mapped[int] = mapped_column(BigInteger)
    token_in_mint: Mapped[str] = mapped_column(String(44))
    token_out_mint: Mapped[str] = mapped_column(String(44))
    amount_in_raw: Mapped[str] = mapped_column(String(64))
    amount_out_raw: Mapped[str] = mapped_column(String(64))
    in_universe: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_helius_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
