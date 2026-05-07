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


async def test_settle_emits_full_onchain_batch_sequence(
    db_session: AsyncSession, monkeypatch
) -> None:
    """Deferred-deploy mode: settle should still walk the full
    register_agent → create_season → join_season → submit_final_score
    → mint_attestation sequence so that when AnchorSubmitter lands the
    call sites are already in place."""
    from app.services import onchain, settlement

    calls: list[tuple[str, tuple]] = []

    class RecordingSubmitter:
        async def register_agent(self, agent):
            calls.append(("register_agent", (agent.wallet_pubkey,)))

        async def create_season(self, season):
            calls.append(("create_season", (season.season_id_onchain,)))

        async def join_season(self, season, agent, entry):
            calls.append(("join_season", (season.season_id_onchain, agent.wallet_pubkey)))

        async def submit_final_score(self, season, score):
            calls.append(("submit_final_score", (season.season_id_onchain, score.agent_id, score.rank)))

        async def mint_attestation(self, season, agent, entry, metadata_uri):
            calls.append(("mint_attestation", (season.season_id_onchain, agent.wallet_pubkey, metadata_uri)))

    monkeypatch.setattr(onchain, "submitter", RecordingSubmitter())
    monkeypatch.setattr(settlement, "submitter", RecordingSubmitter())

    season, alpha, bravo = await _seed_active_season_with_two_agents(db_session)

    await settlement.settle_season(db_session, season=season)

    kinds = [k for k, _ in calls]
    assert kinds.count("register_agent") == 2
    assert kinds.count("create_season") == 1
    assert kinds.count("join_season") == 2
    assert kinds.count("submit_final_score") == 2
    assert kinds.count("mint_attestation") == 2

    # Sequence: all register_agent before create_season, create_season
    # before any join_season, etc.
    first = {k: kinds.index(k) for k in set(kinds)}
    last = {k: len(kinds) - 1 - kinds[::-1].index(k) for k in set(kinds)}
    assert last["register_agent"] < first["create_season"]
    assert last["create_season"] < first["join_season"]
    assert last["join_season"] < first["submit_final_score"]
    assert last["submit_final_score"] < first["mint_attestation"]

    # mint_attestation is given a non-empty metadata_uri.
    mint_uris = [args[2] for k, args in calls if k == "mint_attestation"]
    assert all(uri.startswith("http") for uri in mint_uris)
