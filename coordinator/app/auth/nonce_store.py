import asyncio
import secrets
import time

from app.config import settings

SWEEP_BATCH = 32


class NonceStore:
    """In-memory single-use nonce store with TTL.

    Single-process only — moves to Redis when we run more than one
    coordinator replica. Each `issue` opportunistically prunes a small
    batch of expired entries to bound memory under abandoned-challenge
    traffic.
    """

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._entries: dict[str, tuple[str, float]] = {}
        self._lock = asyncio.Lock()

    async def issue(self, wallet: str) -> tuple[str, int]:
        nonce = secrets.token_urlsafe(32)
        expires_at = time.time() + self._ttl
        async with self._lock:
            now = time.time()
            stale = [
                w
                for w, (_, exp) in list(self._entries.items())[:SWEEP_BATCH]
                if exp < now
            ]
            for w in stale:
                del self._entries[w]
            self._entries[wallet] = (nonce, expires_at)
        return nonce, int(expires_at)

    async def consume(self, wallet: str, nonce: str) -> bool:
        async with self._lock:
            entry = self._entries.get(wallet)
            if entry is None:
                return False
            stored_nonce, expires_at = entry
            if stored_nonce != nonce or time.time() > expires_at:
                return False
            del self._entries[wallet]
            return True


nonce_store = NonceStore(ttl_seconds=settings.nonce_ttl_seconds)
