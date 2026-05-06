"""Jupiter Swap API client — price, quote, swap-tx.

Mirrors the v3 lite price endpoint and the v6 swap endpoints. The
swap path returns a serialized VersionedTransaction the agent
deserializes, signs, and sends to its own RPC. Gladius is not in
this path."""

import base64
from decimal import Decimal
from typing import Any

import httpx

PRICE_API = "https://lite-api.jup.ag/price/v3"
QUOTE_API = "https://quote-api.jup.ag/v6/quote"
SWAP_API = "https://quote-api.jup.ag/v6/swap"


class JupiterClient:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def get_price(self, mint: str) -> Decimal:
        resp = await self._http.get(PRICE_API, params={"ids": mint})
        resp.raise_for_status()
        data = resp.json().get("data", {}).get(mint)
        if not data:
            raise RuntimeError(f"jupiter: no price for {mint}")
        raw = data.get("usdPrice") or data.get("price")
        if raw is None:
            raise RuntimeError(f"jupiter: missing price field for {mint}")
        return Decimal(str(raw))

    async def get_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount_raw: int,
        slippage_bps: int,
    ) -> dict[str, Any]:
        resp = await self._http.get(
            QUOTE_API,
            params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": amount_raw,
                "slippageBps": slippage_bps,
                "swapMode": "ExactIn",
            },
        )
        resp.raise_for_status()
        return resp.json()

    async def get_swap_tx_b64(self, quote: dict[str, Any], user_pubkey: str) -> str:
        resp = await self._http.post(
            SWAP_API,
            json={
                "quoteResponse": quote,
                "userPublicKey": user_pubkey,
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
            },
        )
        resp.raise_for_status()
        return resp.json()["swapTransaction"]

    async def get_swap_tx_bytes(
        self, quote: dict[str, Any], user_pubkey: str
    ) -> bytes:
        b64 = await self.get_swap_tx_b64(quote, user_pubkey)
        return base64.b64decode(b64)
