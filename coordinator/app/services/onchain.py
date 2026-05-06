"""On-chain settlement adapter — Phase 1 stub.

In Phase 1 the coordinator computes final scores off-chain and the
on-chain `submit_final_score` instruction is the canonical write. The
stub records the intent and returns a placeholder signature so the
settlement flow is fully testable. Sprint 5 swaps the stub body for an
anchorpy CPI call against the deployed program at
6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA.
"""

import logging

from app.models import Score, Season

logger = logging.getLogger(__name__)


class OnChainSubmitter:
    async def submit_final_score(self, season: Season, score: Score) -> str:
        logger.info(
            "submit_final_score (stub): season=%d agent=%d pnl_bps=%d sharpe_x1000=%d "
            "max_drawdown_bps=%d trade_count=%d rank=%d",
            season.season_id_onchain,
            score.agent_id,
            score.pnl_bps,
            score.sharpe_x1000,
            score.max_drawdown_bps,
            score.trade_count,
            score.rank,
        )
        return f"stub-{season.season_id_onchain}-{score.agent_id}-{score.rank}"


submitter = OnChainSubmitter()
