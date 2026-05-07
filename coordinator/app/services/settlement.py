"""Season settlement.

Settlement is the single batch point where the season's full state is
emitted on-chain. Until the program is deployed and
`settings.onchain_enabled` flips to True, this batch routes through
`NullSubmitter` and is a no-op — the season still settles in Postgres,
events still fan out, the leaderboard freezes. When AnchorSubmitter
lands, the same sequence becomes real CPI calls.

Sequence:
  1. recompute + rank (Postgres)
  2. submitter.register_agent for each unique participating agent
  3. submitter.create_season
  4. submitter.join_season per entry
  5. submitter.submit_final_score per ranked Score
  6. submitter.mint_attestation per ranked Score
  7. flip Postgres season status to SETTLED
  8. broadcast season_ended events
"""

import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Agent, Score, Season, SeasonEntry, SeasonStatus
from app.schemas.events import GladiusEvent
from app.services.event_broadcaster import broadcaster
from app.services.onchain import submitter
from app.services.scoring import recompute_and_rank_season


class SeasonSettlementError(RuntimeError):
    pass


def _attestation_metadata_uri(season: Season, agent: Agent) -> str:
    return (
        f"{settings.attestation_metadata_base_url.rstrip('/')}"
        f"/{season.season_id_onchain}/{agent.wallet_pubkey}.json"
    )


async def settle_season(
    session: AsyncSession, *, season: Season
) -> list[Score]:
    if season.status not in {SeasonStatus.PENDING, SeasonStatus.ACTIVE}:
        raise SeasonSettlementError(
            f"season {season.season_id_onchain} is in {season.status}, cannot settle"
        )

    ranked = await recompute_and_rank_season(session, season=season)

    entries_rows = await session.execute(
        select(SeasonEntry, Agent)
        .join(Agent, SeasonEntry.agent_id == Agent.id)
        .where(SeasonEntry.season_id == season.id)
    )
    entries = entries_rows.all()
    agents_by_id = {agent.id: agent for _, agent in entries}

    for _entry, agent in entries:
        await submitter.register_agent(agent)
    await submitter.create_season(season)
    for entry, agent in entries:
        await submitter.join_season(season, agent, entry)
    for score in ranked:
        await submitter.submit_final_score(season, score)
    for score in ranked:
        agent = agents_by_id.get(score.agent_id)
        entry = next(
            (e for e, a in entries if a.id == score.agent_id),
            None,
        )
        if agent is None or entry is None:
            continue
        await submitter.mint_attestation(
            season, agent, entry, _attestation_metadata_uri(season, agent)
        )

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
