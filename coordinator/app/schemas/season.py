from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.auth.schemas import WalletAddress
from app.models.season import ScoringMethod, SeasonStatus

TokenMintList = Annotated[list[WalletAddress], Field(max_length=20)]


class SeasonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(default="", max_length=256)
    trading_universe: TokenMintList = Field(default_factory=list)
    max_agents: int = Field(gt=0)
    scoring_method: ScoringMethod = ScoringMethod.RISK_ADJUSTED
    end_time: int = Field(gt=0, description="Unix timestamp")


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    season_id_onchain: int
    season_pda: str | None
    authority: str
    status: SeasonStatus
    name: str
    description: str
    trading_universe: list[str]
    max_agents: int
    scoring_method: ScoringMethod
    start_time: int | None
    end_time: int
    agent_count: int
    created_at: datetime
    onchain_synced_at: datetime | None
