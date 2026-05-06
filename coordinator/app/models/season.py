from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, BigInteger, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SeasonStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class ScoringMethod(StrEnum):
    PNL = "pnl"
    SHARPE = "sharpe"
    RISK_ADJUSTED = "risk_adjusted"


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id_onchain: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    season_pda: Mapped[str | None] = mapped_column(String(44), unique=True)
    authority: Mapped[str] = mapped_column(String(44), index=True)
    status: Mapped[SeasonStatus] = mapped_column(String(16), default=SeasonStatus.PENDING)
    name: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(String(256), default="")
    trading_universe: Mapped[list[str]] = mapped_column(JSON, default=list)
    max_agents: Mapped[int] = mapped_column(Integer)
    scoring_method: Mapped[ScoringMethod] = mapped_column(
        String(16), default=ScoringMethod.RISK_ADJUSTED
    )
    start_time: Mapped[int | None] = mapped_column(BigInteger, default=None)
    end_time: Mapped[int] = mapped_column(BigInteger)
    agent_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    onchain_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
