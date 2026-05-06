import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt_utils import decode_token
from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_wallet(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
        )
    try:
        claims = decode_token(creds.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        ) from exc
    return claims["sub"]


def require_admin(wallet: str = Depends(get_current_wallet)) -> str:
    if not settings.admin_wallet or wallet != settings.admin_wallet:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin only",
        )
    return wallet
