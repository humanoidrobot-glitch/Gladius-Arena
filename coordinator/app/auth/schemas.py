from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field
from solders.pubkey import Pubkey


def _validate_pubkey(v: str) -> str:
    try:
        Pubkey.from_string(v)
    except ValueError as exc:
        raise ValueError("invalid Solana pubkey") from exc
    return v


WalletAddress = Annotated[
    str,
    Field(min_length=32, max_length=44, description="Base58-encoded Solana pubkey"),
    AfterValidator(_validate_pubkey),
]

Base58Signature = Annotated[
    str,
    Field(min_length=86, max_length=88, description="Base58-encoded Ed25519 signature"),
]


class ChallengeRequest(BaseModel):
    wallet: WalletAddress


class ChallengeResponse(BaseModel):
    nonce: str
    expires_at: int


class VerifyRequest(BaseModel):
    wallet: WalletAddress
    nonce: str = Field(min_length=8, max_length=128)
    signature: Base58Signature


class TokenResponse(BaseModel):
    token: str
    expires_at: int
