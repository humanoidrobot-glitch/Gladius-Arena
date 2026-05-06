from decimal import Decimal

import httpx

from app.config import settings
from app.services._http import http_client


class JupiterPriceError(RuntimeError):
    pass


class JupiterPriceClient:
    def __init__(
        self,
        base_url: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or settings.jupiter_price_api_url
        self._client = client

    async def get_prices(self, mints: list[str]) -> dict[str, Decimal]:
        """mint pubkey → USD price. Mints with no price are omitted."""
        if not mints:
            return {}
        async with http_client(self._client) as client:
            resp = await client.get(self._base_url, params={"ids": ",".join(mints)})
            if resp.status_code >= 400:
                raise JupiterPriceError(f"jupiter price → {resp.status_code}: {resp.text}")
            payload = resp.json()
        data = payload.get("data") or payload
        result: dict[str, Decimal] = {}
        for mint, entry in data.items():
            if not isinstance(entry, dict):
                continue
            raw = entry.get("usdPrice") or entry.get("price")
            if raw is None:
                continue
            try:
                result[mint] = Decimal(str(raw))
            except (ValueError, ArithmeticError):
                continue
        return result
