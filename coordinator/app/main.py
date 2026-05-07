from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db.session import engine
from app.routes import agents, auth, avatars, events_ws, health, seasons, webhooks
from app.services.jupiter_prices import JupiterPriceClient
from app.services.snapshot_worker import SnapshotWorker
from app.services.solana_rpc import SolanaRpcClient


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    worker = SnapshotWorker(
        interval_seconds=settings.snapshot_interval_seconds,
        rpc=SolanaRpcClient(),
        prices=JupiterPriceClient(),
    )
    await worker.start()
    try:
        yield
    finally:
        await worker.stop()
        await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gladius Coordinator",
        version="0.1.0",
        description="Observation and scoring layer for Gladius — never executes trades.",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(agents.router)
    app.include_router(avatars.router)
    app.include_router(seasons.router)
    app.include_router(webhooks.router)
    app.include_router(events_ws.router)
    return app


app = create_app()
