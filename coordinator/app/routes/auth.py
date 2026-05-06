from fastapi import APIRouter, HTTPException, status

from app.auth.jwt_utils import issue_token
from app.auth.nonce_store import nonce_store
from app.auth.schemas import (
    ChallengeRequest,
    ChallengeResponse,
    TokenResponse,
    VerifyRequest,
)
from app.auth.verifier import verify_signature

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/challenge", response_model=ChallengeResponse)
async def challenge(req: ChallengeRequest) -> ChallengeResponse:
    nonce, expires_at = await nonce_store.issue(req.wallet)
    return ChallengeResponse(nonce=nonce, expires_at=expires_at)


@router.post("/verify", response_model=TokenResponse)
async def verify(req: VerifyRequest) -> TokenResponse:
    if not await nonce_store.consume(req.wallet, req.nonce):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired nonce",
        )
    if not verify_signature(req.wallet, req.nonce, req.signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid signature",
        )
    token, expires_at = issue_token(req.wallet)
    return TokenResponse(token=token, expires_at=expires_at)
