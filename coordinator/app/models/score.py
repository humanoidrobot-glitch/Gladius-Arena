from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Score(Base):
    """Materialized current score per (season, agent). Updated on every
    new portfolio snapshot or trade-count change. Final values written
    to the on-chain SeasonEntry at settlement time."""

    __tablename__ = "scores"
    __table_args__ = (
        UniqueConstraint("season_id", "agent_id", name="uq_score_season_agent"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id", ondelete="CASCADE"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    starting_balance_usdc: Mapped[int] = mapped_column(BigInteger, default=0)
    balance_usdc: Mapped[int] = mapped_column(BigInteger, default=0)
    pnl_bps: Mapped[int] = mapped_column(Integer, default=0)
    sharpe_x1000: Mapped[int] = mapped_column(Integer, default=0)
    max_drawdown_bps: Mapped[int] = mapped_column(Integer, default=0)
    trade_count: Mapped[int] = mapped_column(Integer, default=0)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    rank: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
