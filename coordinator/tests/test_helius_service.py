import httpx
import pytest
import respx

from app.services.helius import HeliusClient, HeliusError

API_KEY = "test-api-key"
WEBHOOK_URL = "http://test/api/v1/webhooks/helius"
WEBHOOK_SECRET = "test-secret-32-chars-aaaaaaaaaaaa"


def _client() -> HeliusClient:
    return HeliusClient(API_KEY, WEBHOOK_URL, WEBHOOK_SECRET)


@respx.mock
async def test_create_webhook_posts_expected_body() -> None:
    route = respx.post("https://api.helius.xyz/v0/webhooks").mock(
        return_value=httpx.Response(200, json={"webhookID": "wh_123"})
    )
    webhook_id = await _client().create_webhook(["WalletA", "WalletB"])

    assert webhook_id == "wh_123"
    assert route.called
    body = route.calls.last.request.read()
    assert b"WalletA" in body
    assert b"WalletB" in body
    assert b"SWAP" in body
    assert b"enhanced" in body


@respx.mock
async def test_add_addresses_merges_existing() -> None:
    respx.get("https://api.helius.xyz/v0/webhooks/wh_123").mock(
        return_value=httpx.Response(
            200,
            json={
                "webhookID": "wh_123",
                "accountAddresses": ["WalletA"],
                "transactionTypes": ["SWAP"],
            },
        )
    )
    put = respx.put("https://api.helius.xyz/v0/webhooks/wh_123").mock(
        return_value=httpx.Response(200, json={})
    )

    await _client().add_addresses("wh_123", ["WalletB"])

    assert put.called
    body = put.calls.last.request.read()
    assert b"WalletA" in body
    assert b"WalletB" in body


@respx.mock
async def test_create_webhook_raises_on_helius_error() -> None:
    respx.post("https://api.helius.xyz/v0/webhooks").mock(
        return_value=httpx.Response(500, text="server error")
    )
    with pytest.raises(HeliusError):
        await _client().create_webhook(["WalletA"])


@respx.mock
async def test_delete_webhook() -> None:
    route = respx.delete("https://api.helius.xyz/v0/webhooks/wh_123").mock(
        return_value=httpx.Response(204)
    )
    await _client().delete_webhook("wh_123")
    assert route.called
