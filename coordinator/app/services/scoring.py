"""Real-time score computation: PnL, Sharpe, max drawdown.

Incremental design — `ScoreAccumulator.update(balance)` runs in O(1)
per new snapshot, with no need to retain the full return series. The
spec's composite score formula
    score = pnl_pct × (1 − maxDrawdown) × sharpeMultiplier
is reconstructed on-demand from stored components by `composite_score`.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Agent,
    ObservedTrade,
    PortfolioSnapshot,
    Score,
    Season,
    SeasonEntry,
)

USDC_MICRO = Decimal(1_000_000)
BPS = Decimal(10_000)
SHARPE_FIXED_POINT = Decimal(1_000)
HALF = Decimal("0.5")
TWO = Decimal(2)


@dataclass
class ScoreAccumulator:
    n_samples: int = 0
    starting_balance: Decimal = Decimal(0)
    last_balance: Decimal = Decimal(0)
    peak_balance: Decimal = Decimal(0)
    max_drawdown_bps: int = 0
    _running_sum: Decimal = field(default=Decimal(0))
    _running_sum_sq: Decimal = field(default=Decimal(0))

    def update(self, balance: Decimal) -> None:
        if self.n_samples == 0:
            self.starting_balance = balance
            self.last_balance = balance
            self.peak_balance = balance
            self.n_samples = 1
            return

        if self.last_balance > 0:
            r = (balance - self.last_balance) / self.last_balance
            self._running_sum += r
            self._running_sum_sq += r * r

        self.n_samples += 1
        self.last_balance = balance
        if balance > self.peak_balance:
            self.peak_balance = balance
        if self.peak_balance > 0:
            dd = int(((self.peak_balance - balance) / self.peak_balance) * BPS)
            if dd > self.max_drawdown_bps:
                self.max_drawdown_bps = dd

    @property
    def pnl_bps(self) -> int:
        if self.starting_balance == 0:
            return 0
        return int(((self.last_balance - self.starting_balance) / self.starting_balance) * BPS)

    @property
    def sharpe_x1000(self) -> int:
        n_returns = self.n_samples - 1
        if n_returns < 2:
            return 0
        mean = self._running_sum / n_returns
        variance = (self._running_sum_sq / n_returns) - (mean * mean)
        if variance <= 0:
            return 0
        std = variance.sqrt()
        if std == 0:
            return 0
        sharpe = mean / std
        return int(sharpe * SHARPE_FIXED_POINT)


@dataclass(frozen=True)
class ComputedScore:
    starting_balance_usdc: int
    balance_usdc: int
    pnl_bps: int
    sharpe_x1000: int
    max_drawdown_bps: int
    sample_count: int


def compute_score(snapshots: list[PortfolioSnapshot]) -> ComputedScore:
    acc = ScoreAccumulator()
    for snap in snapshots:
        balance = Decimal(snap.total_value_usdc_micro) / USDC_MICRO
        acc.update(balance)
    return ComputedScore(
        starting_balance_usdc=int(acc.starting_balance * USDC_MICRO),
        balance_usdc=int(acc.last_balance * USDC_MICRO),
        pnl_bps=acc.pnl_bps,
        sharpe_x1000=acc.sharpe_x1000,
        max_drawdown_bps=acc.max_drawdown_bps,
        sample_count=acc.n_samples,
    )


def composite_score(score: Score) -> Decimal:
    """Reconstruct the spec's risk-adjusted score from stored components."""
    pnl_pct = Decimal(score.pnl_bps) / Decimal(100)
    dd_factor = (BPS - Decimal(score.max_drawdown_bps)) / BPS
    sharpe = Decimal(score.sharpe_x1000) / SHARPE_FIXED_POINT
    sharpe_mult = max(HALF, min(TWO, sharpe / TWO))
    return pnl_pct * dd_factor * sharpe_mult


async def recompute_score(
    session: AsyncSession, *, season_id: int, agent_id: int
) -> Score:
    snap_rows = await session.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.season_id == season_id)
        .where(PortfolioSnapshot.agent_id == agent_id)
        .order_by(PortfolioSnapshot.timestamp)
    )
    snapshots = list(snap_rows.scalars())
    computed = compute_score(snapshots)

    trade_count_row = await session.execute(
        select(func.count())
        .select_from(ObservedTrade)
        .where(ObservedTrade.season_id == season_id)
        .where(ObservedTrade.agent_id == agent_id)
        .where(ObservedTrade.in_universe.is_(True))
    )
    trade_count = int(trade_count_row.scalar_one())

    existing_row = await session.execute(
        select(Score).where(Score.season_id == season_id, Score.agent_id == agent_id)
    )
    score = existing_row.scalar_one_or_none()
    if score is None:
        score = Score(season_id=season_id, agent_id=agent_id)
        session.add(score)

    score.starting_balance_usdc = computed.starting_balance_usdc
    score.balance_usdc = computed.balance_usdc
    score.pnl_bps = computed.pnl_bps
    score.sharpe_x1000 = computed.sharpe_x1000
    score.max_drawdown_bps = computed.max_drawdown_bps
    score.sample_count = computed.sample_count
    score.trade_count = trade_count
    await session.commit()
    await session.refresh(score)
    return score


async def rerank_season(session: AsyncSession, *, season_id: int) -> list[Score]:
    """Rank all entries in a season by composite score, descending. Writes
    `rank` (1-based) back to each Score row."""
    entries = await session.execute(
        select(Score).where(Score.season_id == season_id)
    )
    scores = list(entries.scalars())
    scores.sort(key=composite_score, reverse=True)
    for idx, s in enumerate(scores, start=1):
        s.rank = idx
    await session.commit()
    return scores


async def recompute_and_rank_season(
    session: AsyncSession, *, season: Season
) -> list[Score]:
    membership = await session.execute(
        select(SeasonEntry, Agent)
        .join(Agent, SeasonEntry.agent_id == Agent.id)
        .where(SeasonEntry.season_id == season.id)
    )
    for entry, _agent in membership.all():
        await recompute_score(
            session, season_id=season.id, agent_id=entry.agent_id
        )
    return await rerank_season(session, season_id=season.id)
