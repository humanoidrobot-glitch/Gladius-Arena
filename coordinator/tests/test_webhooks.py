import time

import pytest
from httpx import AsyncClient
from solders.keypair import Keypair

from app.auth.jwt_utils import issue_token
from app.config import settings

WEBHOOK_SECRET = "helius-test-secret-32-chars-min-aaa"


@pytest.fixture(autouse=True)
def _set_webhook_secret(monkeypatch):
    monkeypatch.setattr(settings, "helius_webhook_secret", WEBHOOK_SECRET)


def _auth_headers(kp: Keypair) -> dict[str, str]:
    token, _ = issue_token(str(kp.pubkey()))
    return {"Authorization": f"Bearer {token}"}


def _webhook_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {WEBHOOK_SECRET}"}


def _swap_payload(
    *,
    fee_payer: str,
    in_mint: str,
    out_mint: str,
    signature: str = "5" * 88,
) -> dict:
    return {
        "signature": signature,
        "type": "SWAP",
        "source": "JUPITER",
        "slot": 460000000,
        "timestamp": int(time.time()),
        "feePayer": fee_payer,
        "tokenTransfers": [
            {
                "mint": out_mint,
                "fromUserAccount": fee_payer,
                "toUserAccount": "Pool111111111111111111111111111111111111111",
                "rawTokenAmount": "1000000000",
                "tokenAmount": 1000.0,
            },
            {
                "mint": in_mint,
                "fromUserAccount": "Pool111111111111111111111111111111111111111",
                "toUserAccount": fee_payer,
                "rawTokenAmount": "5000000",
                "tokenAmount": 5.0,
            },
        ],
    }


async def _seed_agent_in_season(
    client: AsyncClient,
    admin_token: str,
    *,
    trading_universe: list[str] | None = None,
) -> tuple[Keypair, int]:
    season_resp = await client.post(
        "/api/v1/seasons",
        json={
            "name": "T",
            "description": "",
            "trading_universe": trading_universe or [],
            "max_agents": 5,
            "scoring_method": "risk_adjusted",
            "end_time": int(time.time()) + 3600,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert season_resp.status_code == 201
    season_id = season_resp.json()["season_id_onchain"]

    kp = Keypair()
    reg = await client.post(
        "/api/v1/agents/register",
        json={"name": "trader"},
        headers=_auth_headers(kp),
    )
    assert reg.status_code == 201
    join = await client.post(
        f"/api/v1/seasons/{season_id}/join", headers=_auth_headers(kp)
    )
    assert join.status_code == 201
    return kp, season_id


async def test_webhook_rejects_missing_auth(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/webhooks/helius", json=[])
    assert resp.status_code == 401


async def test_webhook_rejects_wrong_secret(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/webhooks/helius",
        json=[],
        headers={"Authorization": "Bearer wrong-secret-value-thirty-two-chars"},
    )
    assert resp.status_code == 401


async def test_webhook_persists_swap_for_registered_agent(
    client: AsyncClient, admin_token: str
) -> None:
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    kp, _ = await _seed_agent_in_season(
        client, admin_token, trading_universe=[SOL, USDC]
    )

    payload = [_swap_payload(fee_payer=str(kp.pubkey()), in_mint=USDC, out_mint=SOL)]
    resp = await client.post(
        "/api/v1/webhooks/helius", json=payload, headers=_webhook_headers()
    )
    assert resp.status_code == 200
    assert resp.json() == {"persisted": 1, "skipped": 0}


async def test_webhook_skips_unknown_wallet(
    client: AsyncClient, admin_token: str
) -> None:
    await _seed_agent_in_season(client, admin_token)
    rando = Keypair()
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    payload = [_swap_payload(fee_payer=str(rando.pubkey()), in_mint=USDC, out_mint=SOL)]

    resp = await client.post(
        "/api/v1/webhooks/helius", json=payload, headers=_webhook_headers()
    )
    assert resp.status_code == 200
    assert resp.json() == {"persisted": 0, "skipped": 1}


async def test_webhook_skips_non_swap_tx(
    client: AsyncClient, admin_token: str
) -> None:
    kp, _ = await _seed_agent_in_season(client, admin_token)
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    payload = _swap_payload(fee_payer=str(kp.pubkey()), in_mint=USDC, out_mint=SOL)
    payload["type"] = "TRANSFER"

    resp = await client.post(
        "/api/v1/webhooks/helius", json=[payload], headers=_webhook_headers()
    )
    assert resp.status_code == 200
    assert resp.json() == {"persisted": 0, "skipped": 1}


async def test_webhook_marks_in_universe_correctly(
    client: AsyncClient, admin_token: str
) -> None:
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    OTHER = "5w8jeKR6jq5xVBJ2dGhsTyTaLcDgQfHmTrPanZJtTSn7"

    kp, _ = await _seed_agent_in_season(
        client, admin_token, trading_universe=[SOL, USDC]
    )

    in_universe = _swap_payload(
        fee_payer=str(kp.pubkey()), in_mint=USDC, out_mint=SOL, signature="A" * 88
    )
    out_of_universe = _swap_payload(
        fee_payer=str(kp.pubkey()), in_mint=OTHER, out_mint=SOL, signature="B" * 88
    )

    resp = await client.post(
        "/api/v1/webhooks/helius",
        json=[in_universe, out_of_universe],
        headers=_webhook_headers(),
    )
    assert resp.status_code == 200
    assert resp.json() == {"persisted": 2, "skipped": 0}


async def test_webhook_dedupes_repeated_tx(
    client: AsyncClient, admin_token: str
) -> None:
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    kp, _ = await _seed_agent_in_season(
        client, admin_token, trading_universe=[SOL, USDC]
    )

    tx = _swap_payload(fee_payer=str(kp.pubkey()), in_mint=USDC, out_mint=SOL)
    first = await client.post(
        "/api/v1/webhooks/helius", json=[tx], headers=_webhook_headers()
    )
    assert first.json() == {"persisted": 1, "skipped": 0}

    replay = await client.post(
        "/api/v1/webhooks/helius", json=[tx], headers=_webhook_headers()
    )
    assert replay.json() == {"persisted": 0, "skipped": 1}


async def test_webhook_empty_universe_treats_all_swaps_as_in_universe(
    client: AsyncClient, admin_token: str
) -> None:
    """Empty trading_universe is interpreted as 'no filter — everything counts'
    rather than 'nothing counts', so seasons created without a universe
    constraint still record swaps as scoring candidates."""
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    kp, _ = await _seed_agent_in_season(client, admin_token, trading_universe=[])

    payload = [_swap_payload(fee_payer=str(kp.pubkey()), in_mint=USDC, out_mint=SOL)]
    resp = await client.post(
        "/api/v1/webhooks/helius", json=payload, headers=_webhook_headers()
    )
    assert resp.status_code == 200
    assert resp.json() == {"persisted": 1, "skipped": 0}


async def test_webhook_handles_fee_deducted_in_same_token(
    client: AsyncClient, admin_token: str
) -> None:
    """Fee deducted in the input token: wallet sends 1000 SOL out + 1 SOL fee
    out, receives USDC. Net-delta aggregation should record SOL out (1001) and
    USDC in, not pick the first 1000 SOL transfer as the only out leg."""
    SOL = "So11111111111111111111111111111111111111112"
    USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
    kp, _ = await _seed_agent_in_season(
        client, admin_token, trading_universe=[SOL, USDC]
    )
    wallet = str(kp.pubkey())

    payload = {
        "signature": "F" * 88,
        "type": "SWAP",
        "source": "JUPITER",
        "slot": 460000001,
        "timestamp": int(time.time()),
        "feePayer": wallet,
        "tokenTransfers": [
            {
                "mint": SOL,
                "fromUserAccount": wallet,
                "toUserAccount": "Pool111111111111111111111111111111111111111",
                "rawTokenAmount": "1000000000",
                "tokenAmount": 1.0,
            },
            {
                "mint": SOL,
                "fromUserAccount": wallet,
                "toUserAccount": "Fee1111111111111111111111111111111111111111",
                "rawTokenAmount": "1000000",
                "tokenAmount": 0.001,
            },
            {
                "mint": USDC,
                "fromUserAccount": "Pool111111111111111111111111111111111111111",
                "toUserAccount": wallet,
                "rawTokenAmount": "200000000",
                "tokenAmount": 200.0,
            },
        ],
    }
    resp = await client.post(
        "/api/v1/webhooks/helius", json=[payload], headers=_webhook_headers()
    )
    assert resp.status_code == 200
    assert resp.json() == {"persisted": 1, "skipped": 0}
