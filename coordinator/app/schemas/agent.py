from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.auth.schemas import WalletAddress


class AgentRegister(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    metadata_uri: str = Field(default="", max_length=200)
    three_ws_agent_id: WalletAddress | None = None


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    wallet_pubkey: str
    name: str
    metadata_uri: str
    three_ws_agent_id: str | None
    created_at: datetime


class SeasonEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    season_id: int
    agent_id: int
    joined_at: datetime
