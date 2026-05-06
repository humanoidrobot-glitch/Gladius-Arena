from httpx import AsyncClient
from solders.keypair import Keypair

from app.auth.jwt_utils import issue_token


def _auth_headers(kp: Keypair) -> dict[str, str]:
    token, _ = issue_token(str(kp.pubkey()))
    return {"Authorization": f"Bearer {token}"}


async def test_register_agent_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/agents/register", json={"name": "X", "metadata_uri": ""}
    )
    assert resp.status_code == 401


async def test_register_agent_succeeds(client: AsyncClient) -> None:
    kp = Keypair()
    resp = await client.post(
        "/api/v1/agents/register",
        json={"name": "alpha", "metadata_uri": "ipfs://meta"},
        headers=_auth_headers(kp),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["wallet_pubkey"] == str(kp.pubkey())
    assert body["name"] == "alpha"
    assert body["three_ws_agent_id"] is None


async def test_register_agent_rejects_duplicate(client: AsyncClient) -> None:
    kp = Keypair()
    headers = _auth_headers(kp)
    first = await client.post(
        "/api/v1/agents/register", json={"name": "alpha"}, headers=headers
    )
    assert first.status_code == 201
    dup = await client.post(
        "/api/v1/agents/register", json={"name": "beta"}, headers=headers
    )
    assert dup.status_code == 409


async def test_get_agent_404(client: AsyncClient) -> None:
    kp = Keypair()
    resp = await client.get(f"/api/v1/agents/{kp.pubkey()}")
    assert resp.status_code == 404


async def test_get_agent_returns_registered(client: AsyncClient) -> None:
    kp = Keypair()
    await client.post(
        "/api/v1/agents/register", json={"name": "lookup"}, headers=_auth_headers(kp)
    )
    resp = await client.get(f"/api/v1/agents/{kp.pubkey()}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "lookup"
