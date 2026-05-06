import time
from typing import TypedDict

import jwt

from app.config import settings

ALGORITHM = "HS256"


class TokenClaims(TypedDict):
    sub: str
    iat: int
    exp: int


def issue_token(wallet: str) -> tuple[str, int]:
    now = int(time.time())
    expires_at = now + settings.jwt_ttl_seconds
    token = jwt.encode(
        {"sub": wallet, "iat": now, "exp": expires_at},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )
    return token, expires_at


def decode_token(token: str) -> TokenClaims:
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
