from typing import Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "swap_detected",
    "balance_updated",
    "score_changed",
    "season_started",
    "season_ended",
]


class GladiusEvent(BaseModel):
    version: int = 1
    type: EventType
    season_id: int
    timestamp: int
    agent_id: int | None = None
    wallet_pubkey: str | None = None
    three_ws_agent_id: str | None = None
    emotion_hint: str | None = None
    data: dict = Field(default_factory=dict)
