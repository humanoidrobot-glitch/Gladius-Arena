import httpx
import pytest
import respx

from app.services.solana_rpc import (
    SOL_NATIVE_MINT,
    SolanaRpcClient,
    SolanaRpcError,
    TokenBalance,
)

RPC_URL = "https://api.devnet.solana.com"
WALLET = "8u8ZnyZXDvL99avsn6pfLZ3dFGWFwJBksJz3xJqmvFSr"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"


def _balance_mock(method: str, value: dict) -> httpx.Response:
    return httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "result": value})


@respx.mock
async def test_get_native_balance_returns_lamports() -> None:
    respx.post(RPC_URL).mock(
        return_value=_balance_mock("getBalance", {"context": {"slot": 1}, "value": 5_000_000_000})
    )
    balance = await SolanaRpcClient(RPC_URL).get_native_balance(WALLET)
    assert balance == 5_000_000_000


@respx.mock
async def test_get_token_balances_aggregates_same_mint() -> None:
    respx.post(RPC_URL).mock(
        return_value=_balance_mock(
            "getTokenAccountsByOwner",
            {
                "value": [
                    {
                        "account": {
                            "data": {
                                "parsed": {
                                    "info": {
                                        "mint": USDC,
                                        "tokenAmount": {"amount": "1000000", "decimals": 6},
                                    }
                                }
                            }
                        }
                    },
                    {
                        "account": {
                            "data": {
                                "parsed": {
                                    "info": {
                                        "mint": USDC,
                                        "tokenAmount": {"amount": "500000", "decimals": 6},
                                    }
                                }
                            }
                        }
                    },
                ]
            },
        )
    )
    balances = await SolanaRpcClient(RPC_URL).get_token_balances(WALLET)
    assert balances == [TokenBalance(mint=USDC, raw_amount=1_500_000, decimals=6)]


@respx.mock
async def test_get_full_balances_includes_native_sol() -> None:
    route = respx.post(RPC_URL).mock(
        side_effect=[
            _balance_mock("getBalance", {"context": {"slot": 1}, "value": 2_000_000_000}),
            _balance_mock("getTokenAccountsByOwner", {"value": []}),
        ]
    )
    balances = await SolanaRpcClient(RPC_URL).get_full_balances(WALLET)
    assert TokenBalance(mint=SOL_NATIVE_MINT, raw_amount=2_000_000_000, decimals=9) in balances
    assert route.call_count == 2


@respx.mock
async def test_get_full_balances_omits_zero_native_sol() -> None:
    respx.post(RPC_URL).mock(
        side_effect=[
            _balance_mock("getBalance", {"context": {"slot": 1}, "value": 0}),
            _balance_mock("getTokenAccountsByOwner", {"value": []}),
        ]
    )
    balances = await SolanaRpcClient(RPC_URL).get_full_balances(WALLET)
    assert balances == []


@respx.mock
async def test_rpc_error_raises() -> None:
    respx.post(RPC_URL).mock(
        return_value=httpx.Response(
            200,
            json={"jsonrpc": "2.0", "id": 1, "error": {"code": -32600, "message": "bad"}},
        )
    )
    with pytest.raises(SolanaRpcError):
        await SolanaRpcClient(RPC_URL).get_native_balance(WALLET)
