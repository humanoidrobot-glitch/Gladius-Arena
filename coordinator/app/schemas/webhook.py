from pydantic import BaseModel, ConfigDict, Field


class TokenTransfer(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    mint: str
    from_user_account: str | None = Field(default=None, alias="fromUserAccount")
    to_user_account: str | None = Field(default=None, alias="toUserAccount")
    raw_token_amount: str | None = Field(default=None, alias="rawTokenAmount")
    token_amount: float | None = Field(default=None, alias="tokenAmount")


class HeliusEnhancedTx(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    signature: str
    type: str
    source: str | None = None
    slot: int
    timestamp: int
    fee: int = 0
    fee_payer: str = Field(alias="feePayer")
    token_transfers: list[TokenTransfer] = Field(default_factory=list, alias="tokenTransfers")
