"""Gladius coordinator client — auth, registration, season join.

Tiny: 4 endpoints. Each method handles the 'already done' state
gracefully (409 → no-op) so the agent can restart without manual
state-tracking on disk.
"""

import logging

import httpx
from solders.keypair import Keypair

logger = logging.getLogger(__name__)


class GladiusClient:
    def __init__(self, base_url: str, http: httpx.AsyncClient) -> None:
        self._base = base_url.rstrip("/")
        self._http = http
        self._token: str | None = None

    @property
    def auth_headers(self) -> dict[str, str]:
        if self._token is None:
            return {}
        return {"Authorization": f"Bearer {self._token}"}

    async def authenticate(self, keypair: Keypair) -> None:
        wallet = str(keypair.pubkey())
        challenge = await self._http.post(
            f"{self._base}/api/v1/auth/challenge", json={"wallet": wallet}
        )
        challenge.raise_for_status()
        nonce = challenge.json()["nonce"]

        signature = keypair.sign_message(nonce.encode("utf-8"))
        verify = await self._http.post(
            f"{self._base}/api/v1/auth/verify",
            json={"wallet": wallet, "nonce": nonce, "signature": str(signature)},
        )
        verify.raise_for_status()
        self._token = verify.json()["token"]
        logger.info("authenticated as %s", wallet)

    async def ensure_agent_registered(
        self,
        name: str,
        metadata_uri: str = "",
        three_ws_agent_id: str | None = None,
    ) -> None:
        body: dict[str, object] = {"name": name, "metadata_uri": metadata_uri}
        if three_ws_agent_id is not None:
            body["three_ws_agent_id"] = three_ws_agent_id
        resp = await self._http.post(
            f"{self._base}/api/v1/agents/register",
            json=body,
            headers=self.auth_headers,
        )
        if resp.status_code == 409:
            logger.info("agent already registered — continuing")
            return
        resp.raise_for_status()
        logger.info("registered as %s", name)

    async def ensure_joined_season(self, season_id: int) -> None:
        resp = await self._http.post(
            f"{self._base}/api/v1/seasons/{season_id}/join",
            headers=self.auth_headers,
        )
        if resp.status_code == 409:
            logger.info("already in season %s — continuing", season_id)
            return
        resp.raise_for_status()
        logger.info("joined season %s", season_id)
