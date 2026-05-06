import time
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from solders.keypair import Keypair
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth.jwt_utils import issue_token
from app.models import Agent, PortfolioSnapshot, Season, SeasonEntry, SeasonStatus
from app.services.event_broadcaster import broadcaster
from app.services.settlement import SeasonSettlementError, settle_season


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


async def _seed_active_season_with_two_agents(
    db_session: AsyncSession,
) -> tuple[Season, Agent, Agent]:
    season = Season(
        season_id_onchain=0,
        season_pda=None,
        authority="A" * 44,
        status=SeasonStatus.ACTIVE,
        name="settle",
        description="",
        trading_universe=[],
        max_agents=10,
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
        PortfolioSnapshot(season_id=season.id, agent_id=a.id,
                          total_value_usdc_micro=1_000_000_000, holdings_json=[], timestamp=0),
        PortfolioSnapshot(season_id=season.id, agent_id=a.id,
                          total_value_usdc_micro=1_500_000_000, holdings_json=[], timestamp=1),
        PortfolioSnapshot(season_id=season.id, agent_id=b.id,
                          total_value_usdc_micro=1_000_000_000, holdings_json=[], timestamp=0),
        PortfolioSnapshot(season_id=season.id, agent_id=b.id,
                          total_value_usdc_micro=900_000_000, holdings_json=[], timestamp=1),
    ])
    await db_session.commit()
    return season, a, b


async def test_settle_season_marks_status_and_ranks(
    db_session: AsyncSession,
) -> None:
    season, alpha, bravo = await _seed_active_season_with_two_agents(db_session)

    ranked = await settle_season(db_session, season=season)

    refreshed = (await db_session.execute(
        select(Season).where(Season.id == season.id)
    )).scalar_one()
    assert refreshed.status == SeasonStatus.SETTLED
    assert ranked[0].agent_id == alpha.id
    assert ranked[0].rank == 1
    assert ranked[1].agent_id == bravo.id
    assert ranked[1].rank == 2


async def test_settle_season_rejects_already_settled(
    db_session: AsyncSession,
) -> None:
    season, _, _ = await _seed_active_season_with_two_agents(db_session)
    await settle_season(db_session, season=season)
    with pytest.raises(SeasonSettlementError):
        await settle_season(db_session, season=season)


async def test_settle_season_publishes_season_ended_events(
    db_session: AsyncSession,
) -> None:
    season, _, _ = await _seed_active_season_with_two_agents(db_session)

    queue = broadcaster.subscribe(season.season_id_onchain)
    try:
        await settle_season(db_session, season=season)
        types = []
        while not queue.empty():
            types.append((await queue.get()).type)
    finally:
        broadcaster.unsubscribe(season.season_id_onchain, queue)

    assert types.count("season_ended") == 2


async def test_settle_route_requires_admin(
    client: AsyncClient,
) -> None:
    not_admin = Keypair()
    token, _ = issue_token(str(not_admin.pubkey()))
    resp = await client.post(
        "/api/v1/seasons/0/settle",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (401, 403)


async def test_settle_route_404_for_missing_season(
    client: AsyncClient, admin_token: str
) -> None:
    resp = await client.post(
        "/api/v1/seasons/999/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404
