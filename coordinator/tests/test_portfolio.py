from collections.abc import AsyncIterator
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Agent, PortfolioSnapshot, Season, SeasonStatus
from app.services.portfolio import compute_value, snapshot_for_agent
from app.services.solana_rpc import TokenBalance

SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"


def test_compute_value_sums_priced_holdings() -> None:
    balances = [
        TokenBalance(mint=SOL, raw_amount=2_000_000_000, decimals=9),
        TokenBalance(mint=USDC, raw_amount=500_000_000, decimals=6),
    ]
    prices = {SOL: Decimal("150"), USDC: Decimal("1")}
    total, holdings = compute_value(balances, prices)
    assert total == Decimal("2") * Decimal("150") + Decimal("500")
    assert {h.mint for h in holdings} == {SOL, USDC}


def test_compute_value_skips_unpriced_mints() -> None:
    balances = [
        TokenBalance(mint=SOL, raw_amount=1_000_000_000, decimals=9),
        TokenBalance(mint="UnknownMint", raw_amount=42, decimals=0),
    ]
    total, holdings = compute_value(balances, {SOL: Decimal("100")})
    assert total == Decimal("100")
    assert len(holdings) == 1


def test_compute_value_handles_zero_balance() -> None:
    total, holdings = compute_value([], {SOL: Decimal("100")})
    assert total == Decimal(0)
    assert holdings == []


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


async def _seed_season_and_agent(session: AsyncSession) -> tuple[Season, Agent]:
    import time

    season = Season(
        season_id_onchain=0,
        season_pda=None,
        authority="A" * 44,
        name="snap-test",
        description="",
        trading_universe=[SOL, USDC],
        max_agents=5,
        end_time=int(time.time()) + 3600,
    )
    agent = Agent(wallet_pubkey="W" * 44, name="snap-agent")
    session.add(season)
    session.add(agent)
    await session.commit()
    await session.refresh(season)
    await session.refresh(agent)
    return season, agent


async def test_snapshot_for_agent_persists_total_and_holdings(
    db_session: AsyncSession,
) -> None:
    season, agent = await _seed_season_and_agent(db_session)

    rpc = AsyncMock()
    rpc.get_full_balances.return_value = [
        TokenBalance(mint=SOL, raw_amount=3_000_000_000, decimals=9),
        TokenBalance(mint=USDC, raw_amount=100_000_000, decimals=6),
    ]
    prices = AsyncMock()
    prices.get_prices.return_value = {SOL: Decimal("150"), USDC: Decimal("1")}

    snap = await snapshot_for_agent(
        db_session,
        season=season,
        agent=agent,
        rpc=rpc,
        prices=prices,
        timestamp=1700000000,
    )

    expected_usd = Decimal("3") * Decimal("150") + Decimal("100")
    assert snap.total_value_usdc_micro == int(expected_usd * Decimal(1_000_000))
    assert snap.timestamp == 1700000000
    assert snap.season_id == season.id
    assert snap.agent_id == agent.id
    assert {h["mint"] for h in snap.holdings_json} == {SOL, USDC}
