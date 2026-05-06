import base64

import httpx
import pytest
import respx

from gladius_sdk import (
    DEFAULT_GLADIUS_PROGRAM_ID,
    MPL_CORE_PROGRAM_ID,
    VerifyError,
    derive_gladius_config_pda,
    verify_attestation,
)

RPC = "https://api.devnet.solana.com"
ASSET = "ATTestAsset111111111111111111111111111111"


def _rpc_response(*, owner: str, data_b64: str = "AA==") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "context": {"slot": 1},
                "value": {
                    "lamports": 12345,
                    "owner": owner,
                    "executable": False,
                    "rentEpoch": 0,
                    "data": [data_b64, "base64"],
                },
            },
        },
    )


def test_derive_gladius_config_pda_is_deterministic() -> None:
    pda = derive_gladius_config_pda(DEFAULT_GLADIUS_PROGRAM_ID)
    assert pda == derive_gladius_config_pda(DEFAULT_GLADIUS_PROGRAM_ID)
    assert len(pda) >= 32  # base58 of 32-byte pubkey is 32-44 chars


@respx.mock
async def test_verify_returns_record_on_valid_asset() -> None:
    respx.post(RPC).mock(return_value=_rpc_response(owner=MPL_CORE_PROGRAM_ID))
    record = await verify_attestation(ASSET, rpc_url=RPC)
    assert record.asset == ASSET
    assert record.owner_program == MPL_CORE_PROGRAM_ID
    assert record.expected_update_authority == derive_gladius_config_pda()
    assert record.metadata is None  # no URI passed → no fetch


@respx.mock
async def test_verify_raises_when_account_missing() -> None:
    respx.post(RPC).mock(
        return_value=httpx.Response(
            200,
            json={"jsonrpc": "2.0", "id": 1, "result": {"context": {"slot": 1}, "value": None}},
        )
    )
    with pytest.raises(VerifyError, match="not found"):
        await verify_attestation(ASSET, rpc_url=RPC)


@respx.mock
async def test_verify_raises_on_wrong_owner_program() -> None:
    respx.post(RPC).mock(return_value=_rpc_response(owner="11111111111111111111111111111111"))
    with pytest.raises(VerifyError, match="owned by"):
        await verify_attestation(ASSET, rpc_url=RPC)


@respx.mock
async def test_verify_fetches_metadata_when_uri_provided() -> None:
    respx.post(RPC).mock(return_value=_rpc_response(owner=MPL_CORE_PROGRAM_ID))
    respx.get("https://example/test.json").mock(
        return_value=httpx.Response(
            200,
            json={
                "name": "Gladius S1 — Hadrian",
                "attributes": [
                    {"trait_type": "Final PnL", "value": "+52.4%"},
                    {"trait_type": "Sharpe Ratio", "value": "2.14"},
                ],
            },
        )
    )

    record = await verify_attestation(
        ASSET, metadata_uri="https://example/test.json", rpc_url=RPC
    )
    assert record.metadata is not None
    assert record.metadata["name"] == "Gladius S1 — Hadrian"
    assert record.metadata["attributes"][0]["value"] == "+52.4%"


@respx.mock
async def test_metadata_fetch_failure_is_non_fatal() -> None:
    respx.post(RPC).mock(return_value=_rpc_response(owner=MPL_CORE_PROGRAM_ID))
    respx.get("https://example/missing.json").mock(
        return_value=httpx.Response(404, text="not found")
    )

    record = await verify_attestation(
        ASSET, metadata_uri="https://example/missing.json", rpc_url=RPC
    )
    assert record.metadata is None  # graceful — verification still succeeded
