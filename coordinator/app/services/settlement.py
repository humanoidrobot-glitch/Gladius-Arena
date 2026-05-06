"""Season settlement: final scores + on-chain submission + status flip."""

import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Score, Season, SeasonStatus
from app.schemas.events import GladiusEvent
from app.services.event_broadcaster import broadcaster
from app.services.onchain import submitter
from app.services.scoring import recompute_and_rank_season


class SeasonSettlementError(RuntimeError):
    pass


async def settle_season(
    session: AsyncSession, *, season: Season
) -> list[Score]:
    if season.status not in {SeasonStatus.PENDING, SeasonStatus.ACTIVE}:
        raise SeasonSettlementError(
            f"season {season.season_id_onchain} is in {season.status}, cannot settle"
        )

    ranked = await recompute_and_rank_season(session, season=season)

    for score in ranked:
        await submitter.submit_final_score(season, score)

    season.status = SeasonStatus.SETTLED
    await session.commit()

    now = int(time.time())
    for score in ranked:
        await broadcaster.publish(
            GladiusEvent(
                type="season_ended",
                season_id=season.season_id_onchain,
                timestamp=now,
                agent_id=score.agent_id,
                data={
                    "final_rank": score.rank,
                    "pnl_bps": score.pnl_bps,
                    "sharpe_x1000": score.sharpe_x1000,
                    "max_drawdown_bps": score.max_drawdown_bps,
                    "trade_count": score.trade_count,
                },
            )
        )

    return ranked
