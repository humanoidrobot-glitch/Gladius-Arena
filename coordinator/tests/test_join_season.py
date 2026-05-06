import time

from httpx import AsyncClient
from solders.keypair import Keypair

from app.auth.jwt_utils import issue_token


def _auth_headers(kp: Keypair) -> dict[str, str]:
    token, _ = issue_token(str(kp.pubkey()))
    return {"Authorization": f"Bearer {token}"}


def _season_payload(name: str = "S1", max_agents: int = 5) -> dict:
    return {
        "name": name,
        "description": "test",
        "trading_universe": [],
        "max_agents": max_agents,
        "scoring_method": "risk_adjusted",
        "end_time": int(time.time()) + 3600,
    }


async def _seed_season(client: AsyncClient, admin_token: str, **overrides) -> int:
    payload = {**_season_payload(), **overrides}
    resp = await client.post(
        "/api/v1/seasons",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    return resp.json()["season_id_onchain"]


async def _seed_agent(client: AsyncClient, kp: Keypair) -> None:
    resp = await client.post(
        "/api/v1/agents/register",
        json={"name": "agent"},
        headers=_auth_headers(kp),
    )
    assert resp.status_code == 201


async def test_join_404_when_season_missing(client: AsyncClient) -> None:
    kp = Keypair()
    await _seed_agent(client, kp)
    resp = await client.post("/api/v1/seasons/0/join", headers=_auth_headers(kp))
    assert resp.status_code == 404


async def test_join_400_when_agent_not_registered(
    client: AsyncClient, admin_token: str
) -> None:
    season_id = await _seed_season(client, admin_token)
    kp = Keypair()
    resp = await client.post(
        f"/api/v1/seasons/{season_id}/join", headers=_auth_headers(kp)
    )
    assert resp.status_code == 400


async def test_join_succeeds_and_increments_agent_count(
    client: AsyncClient, admin_token: str
) -> None:
    season_id = await _seed_season(client, admin_token)
    kp = Keypair()
    await _seed_agent(client, kp)

    resp = await client.post(
        f"/api/v1/seasons/{season_id}/join", headers=_auth_headers(kp)
    )
    assert resp.status_code == 201
    assert resp.json()["season_id"] is not None

    detail = await client.get(f"/api/v1/seasons/{season_id}")
    assert detail.json()["agent_count"] == 1


async def test_join_rejects_duplicate(
    client: AsyncClient, admin_token: str
) -> None:
    season_id = await _seed_season(client, admin_token)
    kp = Keypair()
    await _seed_agent(client, kp)
    headers = _auth_headers(kp)

    first = await client.post(f"/api/v1/seasons/{season_id}/join", headers=headers)
    assert first.status_code == 201
    second = await client.post(f"/api/v1/seasons/{season_id}/join", headers=headers)
    assert second.status_code == 409


async def test_join_rejects_full_season(
    client: AsyncClient, admin_token: str
) -> None:
    season_id = await _seed_season(client, admin_token, max_agents=1)
    first_kp = Keypair()
    second_kp = Keypair()
    await _seed_agent(client, first_kp)
    await _seed_agent(client, second_kp)

    first = await client.post(
        f"/api/v1/seasons/{season_id}/join", headers=_auth_headers(first_kp)
    )
    assert first.status_code == 201

    second = await client.post(
        f"/api/v1/seasons/{season_id}/join", headers=_auth_headers(second_kp)
    )
    assert second.status_code == 409
