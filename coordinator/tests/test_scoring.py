import time
from collections.abc import AsyncIterator
from decimal import Decimal

import pytest_asyncio
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import (
    Agent,
    ObservedTrade,
    PortfolioSnapshot,
    Score,
    Season,
    SeasonEntry,
)
from app.services.scoring import (
    BPS,
    ScoreAccumulator,
    composite_score,
    compute_score,
    recompute_and_rank_season,
    recompute_score,
)


def test_accumulator_handles_no_samples() -> None:
    acc = ScoreAccumulator()
    assert acc.n_samples == 0
    assert acc.pnl_bps == 0
    assert acc.sharpe_x1000 == 0
    assert acc.max_drawdown_bps == 0


def test_accumulator_single_sample_initializes_baseline() -> None:
    acc = ScoreAccumulator()
    acc.update(Decimal(1000))
    assert acc.starting_balance == Decimal(1000)
    assert acc.peak_balance == Decimal(1000)
    assert acc.pnl_bps == 0
    assert acc.max_drawdown_bps == 0


def test_accumulator_pnl_bps_after_gain() -> None:
    acc = ScoreAccumulator()
    acc.update(Decimal(1000))
    acc.update(Decimal(1500))
    assert acc.pnl_bps == 5000  # +50%


def test_accumulator_pnl_bps_after_loss() -> None:
    acc = ScoreAccumulator()
    acc.update(Decimal(1000))
    acc.update(Decimal(750))
    assert acc.pnl_bps == -2500  # -25%


def test_accumulator_max_drawdown_tracks_worst_drop_from_peak() -> None:
    acc = ScoreAccumulator()
    for v in [1000, 1200, 600, 800, 1100]:
        acc.update(Decimal(v))
    # Peak hit 1200, trough was 600 → drawdown = 600/1200 = 50% = 5000 bps
    assert acc.max_drawdown_bps == 5000


def test_accumulator_drawdown_zero_when_monotonic_up() -> None:
    acc = ScoreAccumulator()
    for v in [1000, 1100, 1200, 1300]:
        acc.update(Decimal(v))
    assert acc.max_drawdown_bps == 0


def test_accumulator_sharpe_zero_when_constant_balance() -> None:
    acc = ScoreAccumulator()
    for _ in range(5):
        acc.update(Decimal(1000))
    assert acc.sharpe_x1000 == 0


def test_accumulator_sharpe_positive_when_returns_positive() -> None:
    acc = ScoreAccumulator()
    for v in [1000, 1010, 1020, 1031, 1042]:
        acc.update(Decimal(v))
    assert acc.sharpe_x1000 > 0


def test_compute_score_from_snapshots() -> None:
    snaps = [
        PortfolioSnapshot(
            season_id=1, agent_id=1,
            total_value_usdc_micro=int(v * 1_000_000),
            holdings_json=[], timestamp=t,
        )
        for t, v in enumerate([1000, 1100, 1200])
    ]
    score = compute_score(snaps)
    assert score.starting_balance_usdc == 1_000_000_000
    assert score.balance_usdc == 1_200_000_000
    assert score.pnl_bps == 2000  # +20%
    assert score.sample_count == 3


def test_composite_score_uses_clamped_sharpe_multiplier() -> None:
    high_sharpe = Score(
        season_id=1, agent_id=1,
        pnl_bps=5000, sharpe_x1000=10_000, max_drawdown_bps=0,
    )
    low_sharpe = Score(
        season_id=1, agent_id=1,
        pnl_bps=5000, sharpe_x1000=-5_000, max_drawdown_bps=0,
    )
    # high_sharpe: sharpe=10, clamp(10/2, 0.5, 2.0) = 2.0 → 50% × 1.0 × 2.0 = 100
    # low_sharpe:  sharpe=-5, clamp(-2.5, 0.5, 2.0) = 0.5 → 50% × 1.0 × 0.5 = 25
    assert composite_score(high_sharpe) == Decimal(100)
    assert composite_score(low_sharpe) == Decimal("25.0")


def test_composite_score_drawdown_penalty() -> None:
    no_dd = Score(season_id=1, agent_id=1, pnl_bps=10000, sharpe_x1000=2000, max_drawdown_bps=0)
    half_dd = Score(season_id=1, agent_id=1, pnl_bps=10000, sharpe_x1000=2000, max_drawdown_bps=5000)
    assert composite_score(half_dd) == composite_score(no_dd) / Decimal(2)


@hyp_settings(max_examples=50)
@given(
    balances=st.lists(
        st.decimals(min_value=Decimal("0.01"), max_value=Decimal(10_000), places=2),
        min_size=1, max_size=20,
    ),
)
def test_accumulator_invariants(balances: list[Decimal]) -> None:
    acc = ScoreAccumulator()
    for b in balances:
        acc.update(b)
    assert acc.n_samples == len(balances)
    assert acc.starting_balance == balances[0]
    assert acc.last_balance == balances[-1]
    assert acc.peak_balance == max(balances)
    assert 0 <= acc.max_drawdown_bps <= int(BPS)


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


async def _seed(session: AsyncSession) -> tuple[Season, Agent, Agent]:
    season = Season(
        season_id_onchain=0, season_pda=None, authority="A" * 44,
        name="s", description="", trading_universe=[],
        max_agents=10, end_time=int(time.time()) + 3600,
    )
    agent_a = Agent(wallet_pubkey="A" * 44, name="A")
    agent_b = Agent(wallet_pubkey="B" * 44, name="B")
    session.add_all([season, agent_a, agent_b])
    await session.commit()
    for a in (agent_a, agent_b):
        await session.refresh(a)
    await session.refresh(season)
    session.add_all([
        SeasonEntry(season_id=season.id, agent_id=agent_a.id),
        SeasonEntry(season_id=season.id, agent_id=agent_b.id),
    ])
    await session.commit()
    return season, agent_a, agent_b


async def _add_snapshots(
    session: AsyncSession, season_id: int, agent_id: int, balances: list[float]
) -> None:
    max_ts_row = await session.execute(
        select(func.max(PortfolioSnapshot.timestamp))
        .where(PortfolioSnapshot.season_id == season_id)
        .where(PortfolioSnapshot.agent_id == agent_id)
    )
    base = (max_ts_row.scalar_one() or -1) + 1
    for i, v in enumerate(balances):
        session.add(
            PortfolioSnapshot(
                season_id=season_id,
                agent_id=agent_id,
                total_value_usdc_micro=int(v * 1_000_000),
                holdings_json=[],
                timestamp=base + i,
            )
        )
    await session.commit()


async def test_recompute_score_creates_then_updates_row(
    db_session: AsyncSession,
) -> None:
    season, agent_a, _ = await _seed(db_session)
    await _add_snapshots(db_session, season.id, agent_a.id, [1000, 1100])

    first = await recompute_score(db_session, season_id=season.id, agent_id=agent_a.id)
    assert first.pnl_bps == 1000
    assert first.starting_balance_usdc == 1_000_000_000

    await _add_snapshots(db_session, season.id, agent_a.id, [1300])
    second = await recompute_score(db_session, season_id=season.id, agent_id=agent_a.id)
    assert second.id == first.id
    assert second.pnl_bps == 3000
    assert second.balance_usdc == 1_300_000_000


async def test_recompute_score_counts_only_in_universe_trades(
    db_session: AsyncSession,
) -> None:
    season, agent_a, _ = await _seed(db_session)
    await _add_snapshots(db_session, season.id, agent_a.id, [1000])

    db_session.add_all([
        ObservedTrade(
            season_id=season.id, agent_id=agent_a.id, tx_signature="t1",
            slot=1, timestamp=1, token_in_mint="X", token_out_mint="Y",
            amount_in_raw="1", amount_out_raw="1", in_universe=True,
            raw_helius_json={},
        ),
        ObservedTrade(
            season_id=season.id, agent_id=agent_a.id, tx_signature="t2",
            slot=2, timestamp=2, token_in_mint="X", token_out_mint="Z",
            amount_in_raw="1", amount_out_raw="1", in_universe=False,
            raw_helius_json={},
        ),
    ])
    await db_session.commit()

    score = await recompute_score(db_session, season_id=season.id, agent_id=agent_a.id)
    assert score.trade_count == 1


async def test_recompute_and_rank_orders_by_composite_score(
    db_session: AsyncSession,
) -> None:
    season, agent_a, agent_b = await _seed(db_session)
    await _add_snapshots(db_session, season.id, agent_a.id, [1000, 1500])  # +50%
    await _add_snapshots(db_session, season.id, agent_b.id, [1000, 1100])  # +10%

    ranked = await recompute_and_rank_season(db_session, season=season)
    assert ranked[0].agent_id == agent_a.id
    assert ranked[0].rank == 1
    assert ranked[1].agent_id == agent_b.id
    assert ranked[1].rank == 2
