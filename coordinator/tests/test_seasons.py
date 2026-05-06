import time

from httpx import AsyncClient
from solders.keypair import Keypair

from app.auth.jwt_utils import issue_token


def _payload(name: str = "Season 1") -> dict:
    return {
        "name": name,
        "description": "test",
        "trading_universe": [],
        "max_agents": 5,
        "scoring_method": "risk_adjusted",
        "end_time": int(time.time()) + 3600,
    }


async def test_list_seasons_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/seasons")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_season_404(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/seasons/0")
    assert resp.status_code == 404


async def test_create_season_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/seasons", json=_payload())
    assert resp.status_code == 401


async def test_create_season_rejects_non_admin(
    client: AsyncClient, admin_kp: Keypair
) -> None:
    other = Keypair()
    other_token, _ = issue_token(str(other.pubkey()))
    resp = await client.post(
        "/api/v1/seasons",
        json=_payload(),
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 403


async def test_create_season_admin_succeeds(
    client: AsyncClient, admin_kp: Keypair, admin_token: str
) -> None:
    resp = await client.post(
        "/api/v1/seasons",
        json=_payload("First Season"),
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "First Season"
    assert body["season_id_onchain"] == 0
    assert body["status"] == "pending"
    assert body["authority"] == str(admin_kp.pubkey())


async def test_create_season_assigns_sequential_ids(
    client: AsyncClient, admin_token: str
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    first = await client.post("/api/v1/seasons", json=_payload("A"), headers=headers)
    second = await client.post("/api/v1/seasons", json=_payload("B"), headers=headers)
    assert first.json()["season_id_onchain"] == 0
    assert second.json()["season_id_onchain"] == 1


async def test_get_season_returns_created(
    client: AsyncClient, admin_token: str
) -> None:
    headers = {"Authorization": f"Bearer {admin_token}"}
    await client.post("/api/v1/seasons", json=_payload("Lookup"), headers=headers)

    resp = await client.get("/api/v1/seasons/0")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Lookup"
