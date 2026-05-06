"""Background snapshot + scoring worker.

Periodically iterates active seasons, takes a portfolio snapshot per
joined agent, and triggers a full season recompute + rerank. Each
snapshot fans out a `balance_updated` event; each rerank fans out a
`score_changed` event per agent with rank-change deltas. This is what
makes the leaderboard move during a live season instead of only at
settlement.

Single-process design — the broadcaster + the Postgres advisory lock
this would need for multi-replica are deferred to Phase 2 along with
the broadcaster's Redis migration.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.session import SessionLocal
from app.models import Agent, PortfolioSnapshot, Score, Season, SeasonEntry, SeasonStatus
from app.schemas.events import GladiusEvent
from app.services.event_broadcaster import broadcaster
from app.services.jupiter_prices import JupiterPriceClient
from app.services.portfolio import snapshot_for_agent
from app.services.scoring import recompute_and_rank_season
from app.services.solana_rpc import SolanaRpcClient

logger = logging.getLogger(__name__)


class SnapshotWorker:
    def __init__(
        self,
        *,
        interval_seconds: int,
        rpc: SolanaRpcClient,
        prices: JupiterPriceClient,
        session_factory: async_sessionmaker | None = None,
    ) -> None:
        self._interval = interval_seconds
        self._rpc = rpc
        self._prices = prices
        self._session_factory = session_factory or SessionLocal
        self._stop = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._interval <= 0:
            logger.info("snapshot worker disabled (interval=%d)", self._interval)
            return
        if self._task is not None:
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="snapshot-worker")
        logger.info("snapshot worker started (interval=%ds)", self._interval)

    async def stop(self) -> None:
        if self._task is None:
            return
        self._stop.set()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None
            logger.info("snapshot worker stopped")

    async def tick_once(self) -> None:
        """Run a single tick. Useful for tests."""
        async with self._session_factory() as session:
            seasons = await self._active_seasons(session)
            for season in seasons:
                await self._tick_season(session, season)

    async def _run(self) -> None:
        while not self._stop.is_set():
            try:
                await self.tick_once()
            except Exception:
                logger.exception("snapshot tick failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval)
                return
            except asyncio.TimeoutError:
                continue

    async def _active_seasons(self, session) -> list[Season]:
        result = await session.execute(
            select(Season).where(
                Season.status.in_([SeasonStatus.PENDING, SeasonStatus.ACTIVE])
            )
        )
        return list(result.scalars())

    async def _tick_season(self, session, season: Season) -> None:
        entries = await self._entries(session, season.id)
        if not entries:
            return

        prev_ranks = await self._previous_ranks(session, season.id)

        for entry, agent in entries:
            try:
                await self._snapshot_and_emit_balance(session, season, agent)
            except Exception:
                logger.exception(
                    "snapshot failed: season=%d agent=%d wallet=%s",
                    season.season_id_onchain,
                    agent.id,
                    agent.wallet_pubkey,
                )

        try:
            ranked = await recompute_and_rank_season(session, season=season)
        except Exception:
            logger.exception(
                "rerank failed: season=%d", season.season_id_onchain
            )
            return

        await self._emit_score_changed(season, ranked, entries, prev_ranks)

    async def _snapshot_and_emit_balance(
        self, session, season: Season, agent: Agent
    ) -> None:
        prev = await self._latest_snapshot(session, season.id, agent.id)
        first = await self._first_snapshot(session, season.id, agent.id)

        snap = await snapshot_for_agent(
            session, season=season, agent=agent,
            rpc=self._rpc, prices=self._prices,
        )

        prev_total = prev.total_value_usdc_micro if prev else 0
        first_total = first.total_value_usdc_micro if first else snap.total_value_usdc_micro

        pnl_change_pct = (
            (snap.total_value_usdc_micro - prev_total) / prev_total * 100.0
            if prev_total > 0
            else 0.0
        )
        total_pnl_pct = (
            (snap.total_value_usdc_micro - first_total) / first_total * 100.0
            if first_total > 0
            else 0.0
        )

        await broadcaster.publish(
            GladiusEvent(
                type="balance_updated",
                season_id=season.season_id_onchain,
                timestamp=int(time.time()),
                agent_id=agent.id,
                wallet_pubkey=agent.wallet_pubkey,
                three_ws_agent_id=agent.three_ws_agent_id,
                data={
                    "total_value_usdc": snap.total_value_usdc_micro / 1_000_000,
                    "pnl_change_pct": pnl_change_pct,
                    "total_pnl_pct": total_pnl_pct,
                },
            )
        )

    async def _emit_score_changed(
        self,
        season: Season,
        ranked: Iterable[Score],
        entries: list[tuple[SeasonEntry, Agent]],
        prev_ranks: dict[int, int],
    ) -> None:
        agent_by_id = {a.id: a for _, a in entries}
        now = int(time.time())
        for score in ranked:
            agent = agent_by_id.get(score.agent_id)
            if agent is None:
                continue
            prev_rank = prev_ranks.get(score.agent_id, 0)
            rank_change = (prev_rank - score.rank) if prev_rank > 0 else 0
            await broadcaster.publish(
                GladiusEvent(
                    type="score_changed",
                    season_id=season.season_id_onchain,
                    timestamp=now,
                    agent_id=score.agent_id,
                    wallet_pubkey=agent.wallet_pubkey,
                    three_ws_agent_id=agent.three_ws_agent_id,
                    data={
                        "rank": score.rank,
                        "rank_change": rank_change,
                        "sharpe_ratio": score.sharpe_x1000 / 1000.0,
                        "max_drawdown_bps": score.max_drawdown_bps,
                        "pnl_bps": score.pnl_bps,
                    },
                )
            )

    async def _entries(
        self, session, season_id: int
    ) -> list[tuple[SeasonEntry, Agent]]:
        result = await session.execute(
            select(SeasonEntry, Agent)
            .join(Agent, SeasonEntry.agent_id == Agent.id)
            .where(SeasonEntry.season_id == season_id)
        )
        return [(e, a) for e, a in result.all()]

    async def _previous_ranks(self, session, season_id: int) -> dict[int, int]:
        result = await session.execute(
            select(Score.agent_id, Score.rank).where(Score.season_id == season_id)
        )
        return {agent_id: rank for agent_id, rank in result.all()}

    async def _latest_snapshot(
        self, session, season_id: int, agent_id: int
    ) -> PortfolioSnapshot | None:
        result = await session.execute(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.season_id == season_id)
            .where(PortfolioSnapshot.agent_id == agent_id)
            .order_by(PortfolioSnapshot.timestamp.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _first_snapshot(
        self, session, season_id: int, agent_id: int
    ) -> PortfolioSnapshot | None:
        result = await session.execute(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.season_id == season_id)
            .where(PortfolioSnapshot.agent_id == agent_id)
            .order_by(PortfolioSnapshot.timestamp.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()
