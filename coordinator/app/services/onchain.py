"""On-chain submitter interface.

Phase 1 runs the entire season off-chain (Postgres + Helius + scoring +
WebSocket). The on-chain program isn't read by anything during a live
season — agent registry, season state, and entry membership are all in
Postgres. The on-chain accounts are write-only until settlement.

That gives us a deferred-deploy option: don't deploy the program until
shortly before the first settle-able season ends, and at settlement
batch-emit every on-chain write that would have happened during the
season — register_agent, create_season, join_season, submit_final_score,
mint_attestation — in one sequence.

This module abstracts that. Two implementations:

- `NullSubmitter` (Phase 1 default): every method is a no-op that logs
  intent. Lets seasons run end-to-end with no deployed program.
- `AnchorSubmitter` (TODO, lands when wiring real CPIs): same interface,
  bodies replaced with anchorpy calls against the deployed program.

Caller code (`settlement.py`) doesn't know which is in use — `submitter`
is a module-level singleton selected at import time from
`settings.onchain_enabled`. Flipping that flag is the single switch
between off-chain mode and live mode.
"""

import logging
from typing import Protocol

from app.config import settings
from app.models import Agent, Score, Season, SeasonEntry

logger = logging.getLogger(__name__)


class OnChainSubmitter(Protocol):
    async def register_agent(self, agent: Agent) -> str | None: ...

    async def create_season(self, season: Season) -> str | None: ...

    async def join_season(
        self, season: Season, agent: Agent, entry: SeasonEntry
    ) -> str | None: ...

    async def submit_final_score(
        self, season: Season, score: Score
    ) -> str | None: ...

    async def mint_attestation(
        self,
        season: Season,
        agent: Agent,
        entry: SeasonEntry,
        metadata_uri: str,
    ) -> str | None: ...


class NullSubmitter:
    """Records intent in logs and otherwise does nothing. The right impl
    when the program isn't deployed yet — seasons still run, settlement
    still completes, and once `AnchorSubmitter` lands the same call sites
    just route through it instead."""

    async def register_agent(self, agent: Agent) -> None:
        logger.info(
            "register_agent (deferred): wallet=%s name=%s",
            agent.wallet_pubkey,
            agent.name,
        )
        return None

    async def create_season(self, season: Season) -> None:
        logger.info(
            "create_season (deferred): season_id=%d name=%s",
            season.season_id_onchain,
            season.name,
        )
        return None

    async def join_season(
        self, season: Season, agent: Agent, entry: SeasonEntry
    ) -> None:
        logger.info(
            "join_season (deferred): season_id=%d agent=%s",
            season.season_id_onchain,
            agent.wallet_pubkey,
        )
        return None

    async def submit_final_score(self, season: Season, score: Score) -> None:
        logger.info(
            "submit_final_score (deferred): season=%d agent=%d pnl_bps=%d "
            "sharpe_x1000=%d max_drawdown_bps=%d trade_count=%d rank=%d",
            season.season_id_onchain,
            score.agent_id,
            score.pnl_bps,
            score.sharpe_x1000,
            score.max_drawdown_bps,
            score.trade_count,
            score.rank,
        )
        return None

    async def mint_attestation(
        self,
        season: Season,
        agent: Agent,
        entry: SeasonEntry,
        metadata_uri: str,
    ) -> None:
        logger.info(
            "mint_attestation (deferred): season=%d agent=%s metadata_uri=%s",
            season.season_id_onchain,
            agent.wallet_pubkey,
            metadata_uri,
        )
        return None


def _make_submitter() -> OnChainSubmitter:
    if settings.onchain_enabled:
        # Lazy import — keeps `anchorpy` out of the dep tree until the
        # AnchorSubmitter lands and someone actually flips this flag.
        from app.services.onchain_anchor import AnchorSubmitter  # noqa: PLC0415

        return AnchorSubmitter()
    return NullSubmitter()


submitter: OnChainSubmitter = _make_submitter()
