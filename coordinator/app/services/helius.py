"""Helius API client for webhook lifecycle.

Single-coordinator-instance assumption: each season can have its own
Helius webhook (returned `webhook_id` is stored on `SeasonEntry` so we
can update / delete later). For Phase 2 multi-replica deployments this
should move behind a queue or a dedicated webhook-management service.
"""

from typing import Any

import httpx

from app.config import settings

_BASE = "https://api.helius.xyz/v0/webhooks"


class HeliusError(RuntimeError):
    pass


class HeliusClient:
    def __init__(
        self,
        api_key: str | None = None,
        webhook_url: str | None = None,
        webhook_secret: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key or settings.helius_api_key
        self._webhook_url = webhook_url or settings.helius_webhook_url
        self._webhook_secret = webhook_secret or settings.helius_webhook_secret
        self._client = client

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{_BASE}{path}"
        params = {"api-key": self._api_key}
        if self._client is not None:
            resp = await self._client.request(method, url, params=params, **kwargs)
        else:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.request(method, url, params=params, **kwargs)
        if resp.status_code >= 400:
            raise HeliusError(f"helius {method} {path} → {resp.status_code}: {resp.text}")
        return resp.json() if resp.content else None

    async def create_webhook(self, addresses: list[str]) -> str:
        body = {
            "webhookURL": self._webhook_url,
            "transactionTypes": ["SWAP"],
            "accountAddresses": addresses,
            "webhookType": "enhanced",
            "authHeader": f"Bearer {self._webhook_secret}",
        }
        data = await self._request("POST", "", json=body)
        return data["webhookID"]

    async def add_addresses(self, webhook_id: str, addresses: list[str]) -> None:
        current = await self._request("GET", f"/{webhook_id}")
        merged = sorted({*current.get("accountAddresses", []), *addresses})
        body = {**current, "accountAddresses": merged}
        await self._request("PUT", f"/{webhook_id}", json=body)

    async def delete_webhook(self, webhook_id: str) -> None:
        await self._request("DELETE", f"/{webhook_id}")
