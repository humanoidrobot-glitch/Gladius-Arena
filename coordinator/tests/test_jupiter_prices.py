from decimal import Decimal

import httpx
import pytest
import respx

from app.services.jupiter_prices import JupiterPriceClient, JupiterPriceError

BASE = "https://lite-api.jup.ag/price/v3"
SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"


@respx.mock
async def test_get_prices_returns_decimal_map() -> None:
    respx.get(BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "data": {
                    SOL: {"id": SOL, "usdPrice": "150.25"},
                    USDC: {"id": USDC, "usdPrice": "1.0001"},
                }
            },
        )
    )
    prices = await JupiterPriceClient(BASE).get_prices([SOL, USDC])
    assert prices == {SOL: Decimal("150.25"), USDC: Decimal("1.0001")}


@respx.mock
async def test_get_prices_skips_missing_entries() -> None:
    respx.get(BASE).mock(
        return_value=httpx.Response(
            200,
            json={"data": {SOL: {"usdPrice": "150"}, USDC: None}},
        )
    )
    prices = await JupiterPriceClient(BASE).get_prices([SOL, USDC])
    assert prices == {SOL: Decimal("150")}


async def test_get_prices_returns_empty_for_empty_input() -> None:
    prices = await JupiterPriceClient(BASE).get_prices([])
    assert prices == {}


@respx.mock
async def test_get_prices_raises_on_http_error() -> None:
    respx.get(BASE).mock(return_value=httpx.Response(503, text="upstream"))
    with pytest.raises(JupiterPriceError):
        await JupiterPriceClient(BASE).get_prices([SOL])
