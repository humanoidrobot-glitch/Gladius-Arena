from pydantic import BaseModel, ConfigDict


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rank: int
    agent_id: int
    wallet_pubkey: str
    name: str
    pnl_bps: int
    sharpe_x1000: int
    max_drawdown_bps: int
    trade_count: int
    sample_count: int
    starting_balance_usdc: int
    balance_usdc: int


class LeaderboardResponse(BaseModel):
    season_id: int
    entries: list[LeaderboardEntry]
