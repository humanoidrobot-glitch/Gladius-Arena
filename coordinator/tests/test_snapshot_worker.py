import time
from collections.abc import AsyncIterator
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import (
    Agent,
    PortfolioSnapshot,
    Score,
    Season,
    SeasonEntry,
    SeasonStatus,
)
from app.services.event_broadcaster import broadcaster
from app.services.snapshot_worker import SnapshotWorker
from app.services.solana_rpc import TokenBalance

SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


def _mock_rpc(balances: list[TokenBalance]) -> AsyncMock:
    rpc = AsyncMock()
    rpc.get_full_balances.return_value = balances
    return rpc


def _mock_prices(price_map: dict[str, Decimal]) -> AsyncMock:
    prices = AsyncMock()
    prices.get_prices.return_value = price_map
    return prices


async def _seed_active_season_with_two_agents(
    db_session: AsyncSession,
) -> tuple[Season, Agent, Agent]:
    season = Season(
        season_id_onchain=0, season_pda=None, authority="A" * 44,
        status=SeasonStatus.ACTIVE, name="live", description="",
        trading_universe=[], max_agents=10,
        end_time=int(time.time()) + 3600,
    )
    a = Agent(wallet_pubkey="A" * 44, name="alpha")
    b = Agent(wallet_pubkey="B" * 44, name="bravo")
    db_session.add_all([season, a, b])
    await db_session.commit()
    for x in (season, a, b):
        await db_session.refresh(x)
    db_session.add_all([
        SeasonEntry(season_id=season.id, agent_id=a.id),
        SeasonEntry(season_id=season.id, agent_id=b.id),
    ])
    await db_session.commit()
    return season, a, b


async def test_tick_once_takes_snapshots_for_all_entries(
    db_session: AsyncSession, test_engine
) -> None:
    season, a, b = await _seed_active_season_with_two_agents(db_session)

    rpc = _mock_rpc([
        TokenBalance(mint=SOL, raw_amount=10_000_000_000, decimals=9),
    ])
    prices = _mock_prices({SOL: Decimal("100")})

    worker = SnapshotWorker(
        interval_seconds=0,
        rpc=rpc,
        prices=prices,
        session_factory=async_sessionmaker(test_engine, expire_on_commit=False),
    )
    await worker.tick_once()

    snaps = (await db_session.execute(select(PortfolioSnapshot))).scalars().all()
    assert len(snaps) == 2
    assert {s.agent_id for s in snaps} == {a.id, b.id}
    assert all(s.total_value_usdc_micro == 1_000_000_000 for s in snaps)


async def test_tick_once_emits_balance_updated_per_snapshot(
    db_session: AsyncSession, test_engine
) -> None:
    season, _a, _b = await _seed_active_season_with_two_agents(db_session)

    rpc = _mock_rpc([TokenBalance(mint=SOL, raw_amount=5_000_000_000, decimals=9)])
    prices = _mock_prices({SOL: Decimal("100")})

    queue = broadcaster.subscribe(season.season_id_onchain)
    try:
        worker = SnapshotWorker(
            interval_seconds=0, rpc=rpc, prices=prices,
            session_factory=async_sessionmaker(test_engine, expire_on_commit=False),
        )
        await worker.tick_once()

        types: list[str] = []
        while not queue.empty():
            types.append((await queue.get()).type)
    finally:
        broadcaster.unsubscribe(season.season_id_onchain, queue)

    assert types.count("balance_updated") == 2
    assert types.count("score_changed") == 2


async def test_tick_once_writes_scores_and_ranks(
    db_session: AsyncSession, test_engine
) -> None:
    season, a, b = await _seed_active_season_with_two_agents(db_session)

    # First tick: both at $500.
    rpc = _mock_rpc([TokenBalance(mint=SOL, raw_amount=5_000_000_000, decimals=9)])
    prices = _mock_prices({SOL: Decimal("100")})
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    worker = SnapshotWorker(
        interval_seconds=0, rpc=rpc, prices=prices, session_factory=Session,
    )
    await worker.tick_once()

    # Second tick: agent a doubles, agent b stays — ranks should differ.
    async def get_balances_for_agent(wallet: str) -> list[TokenBalance]:
        if wallet == a.wallet_pubkey:
            return [TokenBalance(mint=SOL, raw_amount=10_000_000_000, decimals=9)]
        return [TokenBalance(mint=SOL, raw_amount=5_000_000_000, decimals=9)]

    rpc.get_full_balances.side_effect = get_balances_for_agent
    await worker.tick_once()

    scores = (await db_session.execute(select(Score))).scalars().all()
    by_agent = {s.agent_id: s for s in scores}
    assert by_agent[a.id].rank == 1
    assert by_agent[b.id].rank == 2
    assert by_agent[a.id].pnl_bps == 10000  # +100%
    assert by_agent[b.id].pnl_bps == 0


async def test_one_failing_snapshot_does_not_block_the_other(
    db_session: AsyncSession, test_engine
) -> None:
    season, a, _b = await _seed_active_season_with_two_agents(db_session)

    rpc = AsyncMock()

    async def selective_rpc(wallet: str) -> list[TokenBalance]:
        if wallet == a.wallet_pubkey:
            raise RuntimeError("simulated rpc outage")
        return [TokenBalance(mint=SOL, raw_amount=5_000_000_000, decimals=9)]

    rpc.get_full_balances.side_effect = selective_rpc
    prices = _mock_prices({SOL: Decimal("100")})

    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    worker = SnapshotWorker(
        interval_seconds=0, rpc=rpc, prices=prices, session_factory=Session,
    )
    await worker.tick_once()

    snaps = (await db_session.execute(select(PortfolioSnapshot))).scalars().all()
    assert len(snaps) == 1  # only the surviving agent got a snapshot


async def test_disabled_when_interval_is_zero() -> None:
    rpc = _mock_rpc([])
    prices = _mock_prices({})
    worker = SnapshotWorker(interval_seconds=0, rpc=rpc, prices=prices)
    await worker.start()
    # No background task should be running.
    assert worker._task is None
    await worker.stop()  # no-op
