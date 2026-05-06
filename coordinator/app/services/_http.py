from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx


@asynccontextmanager
async def http_client(
    injected: httpx.AsyncClient | None,
    timeout: float = 10.0,
) -> AsyncIterator[httpx.AsyncClient]:
    """Yield the injected client if present, otherwise own a per-call one.

    Lets services accept an optional client (for tests / shared pooling)
    without each implementing the same conditional context plumbing.
    """
    if injected is not None:
        yield injected
        return
    async with httpx.AsyncClient(timeout=timeout) as client:
        yield client
