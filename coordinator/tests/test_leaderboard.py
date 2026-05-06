import time
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import AsyncClient
from solders.keypair import Keypair
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth.jwt_utils import issue_token
from app.models import Agent, PortfolioSnapshot, Season, SeasonEntry
from app.services.scoring import recompute_and_rank_season


def _auth_headers(kp: Keypair) -> dict[str, str]:
    token, _ = issue_token(str(kp.pubkey()))
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


async def test_leaderboard_404_for_missing_season(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/seasons/0/leaderboard")
    assert resp.status_code == 404


async def test_leaderboard_empty_when_no_entries(
    client: AsyncClient, admin_token: str
) -> None:
    create = await client.post(
        "/api/v1/seasons",
        json={
            "name": "Empty",
            "description": "",
            "trading_universe": [],
            "max_agents": 5,
            "scoring_method": "risk_adjusted",
            "end_time": int(time.time()) + 3600,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create.status_code == 201

    resp = await client.get("/api/v1/seasons/0/leaderboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["season_id"] == 0
    assert body["entries"] == []


async def test_leaderboard_orders_entries_by_rank(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
) -> None:
    create = await client.post(
        "/api/v1/seasons",
        json={
            "name": "Ranked",
            "description": "",
            "trading_universe": [],
            "max_agents": 5,
            "scoring_method": "risk_adjusted",
            "end_time": int(time.time()) + 3600,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create.status_code == 201

    season_row = await db_session.execute(
        Season.__table__.select().where(Season.season_id_onchain == 0)
    )
    season_id_db = season_row.scalar_one()

    winner = Agent(wallet_pubkey="W" * 44, name="winner")
    loser = Agent(wallet_pubkey="L" * 44, name="loser")
    db_session.add_all([winner, loser])
    await db_session.commit()
    await db_session.refresh(winner)
    await db_session.refresh(loser)

    db_session.add_all([
        SeasonEntry(season_id=season_id_db, agent_id=winner.id),
        SeasonEntry(season_id=season_id_db, agent_id=loser.id),
        PortfolioSnapshot(season_id=season_id_db, agent_id=winner.id,
                          total_value_usdc_micro=1_000_000_000, holdings_json=[], timestamp=0),
        PortfolioSnapshot(season_id=season_id_db, agent_id=winner.id,
                          total_value_usdc_micro=2_000_000_000, holdings_json=[], timestamp=1),
        PortfolioSnapshot(season_id=season_id_db, agent_id=loser.id,
                          total_value_usdc_micro=1_000_000_000, holdings_json=[], timestamp=0),
        PortfolioSnapshot(season_id=season_id_db, agent_id=loser.id,
                          total_value_usdc_micro=900_000_000, holdings_json=[], timestamp=1),
    ])
    await db_session.commit()

    season = await db_session.get(Season, season_id_db)
    await recompute_and_rank_season(db_session, season=season)

    resp = await client.get("/api/v1/seasons/0/leaderboard")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["entries"]) == 2
    assert body["entries"][0]["name"] == "winner"
    assert body["entries"][0]["rank"] == 1
    assert body["entries"][0]["pnl_bps"] == 10000
    assert body["entries"][1]["name"] == "loser"
    assert body["entries"][1]["rank"] == 2
