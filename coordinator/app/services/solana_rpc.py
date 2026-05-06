import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings
from app.services._http import http_client

SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112"
SOL_DECIMALS = 9


@dataclass(frozen=True)
class TokenBalance:
    mint: str
    raw_amount: int
    decimals: int


class SolanaRpcError(RuntimeError):
    pass


class SolanaRpcClient:
    def __init__(
        self,
        rpc_url: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._rpc_url = rpc_url or settings.rpc_url
        self._client = client

    async def _post(self, method: str, params: list[Any]) -> Any:
        body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        async with http_client(self._client) as client:
            resp = await client.post(self._rpc_url, json=body)
            if resp.status_code >= 400:
                raise SolanaRpcError(f"rpc {method} → {resp.status_code}: {resp.text}")
            data = resp.json()
        if "error" in data:
            raise SolanaRpcError(f"rpc {method} error: {data['error']}")
        return data["result"]

    async def get_native_balance(self, wallet: str) -> int:
        result = await self._post("getBalance", [wallet])
        return int(result["value"])

    async def get_token_balances(self, wallet: str) -> list[TokenBalance]:
        result = await self._post(
            "getTokenAccountsByOwner",
            [
                wallet,
                {"programId": SPL_TOKEN_PROGRAM},
                {"encoding": "jsonParsed"},
            ],
        )
        agg: dict[tuple[str, int], int] = {}
        for acc in result["value"]:
            info = acc["account"]["data"]["parsed"]["info"]
            amt = info["tokenAmount"]
            key = (info["mint"], int(amt["decimals"]))
            agg[key] = agg.get(key, 0) + int(amt["amount"])
        return [
            TokenBalance(mint=m, raw_amount=raw, decimals=d)
            for (m, d), raw in agg.items()
        ]

    async def get_full_balances(self, wallet: str) -> list[TokenBalance]:
        """Native SOL (folded into wSOL mint) + SPL tokens."""
        lamports, tokens = await asyncio.gather(
            self.get_native_balance(wallet),
            self.get_token_balances(wallet),
        )
        if lamports > 0:
            tokens.append(
                TokenBalance(
                    mint=SOL_NATIVE_MINT, raw_amount=lamports, decimals=SOL_DECIMALS
                )
            )
        return tokens
