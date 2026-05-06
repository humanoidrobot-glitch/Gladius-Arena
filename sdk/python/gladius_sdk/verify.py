"""Verify a Gladius performance attestation from Python.

The full-fat verifier is the TypeScript package — the mpl-core JS
library handles the binary asset deserialization. The Python SDK
gets you the operationally meaningful checks (account exists, owned
by mpl-core, metadata JSON fetched and parsed) without re-implementing
the Borsh layout.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

import httpx
from solders.pubkey import Pubkey

DEFAULT_GLADIUS_PROGRAM_ID = "6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA"
MPL_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"

GLADIUS_CONFIG_SEED = b"gladius_config"


class VerifyError(RuntimeError):
    pass


def derive_gladius_config_pda(program_id: str = DEFAULT_GLADIUS_PROGRAM_ID) -> str:
    program = Pubkey.from_string(program_id)
    pda, _bump = Pubkey.find_program_address([GLADIUS_CONFIG_SEED], program)
    return str(pda)


@dataclass(frozen=True)
class AttestationVerification:
    """Result of verifying a Gladius attestation asset."""

    asset: str
    """The asset pubkey (base58)."""

    owner_program: str
    """The program that owns the account — must equal MPL_CORE_PROGRAM_ID."""

    expected_update_authority: str
    """Derived gladius_config PDA — what the asset's update_authority should be."""

    raw_data_b64: str
    """Base64-encoded asset account data. Decode with mpl-core libraries
    if you need the structured fields (name, uri, plugins). The TypeScript
    SDK does this for you; Python users can shell out to it via subprocess
    or write the Borsh parser themselves."""

    metadata: dict[str, Any] | None
    """Parsed metadata JSON if `uri` was readable. None on fetch failure."""


async def verify_attestation(
    asset_pubkey: str,
    metadata_uri: str | None = None,
    rpc_url: str = "https://api.devnet.solana.com",
    program_id: str = DEFAULT_GLADIUS_PROGRAM_ID,
    *,
    http: httpx.AsyncClient | None = None,
) -> AttestationVerification:
    """Fetch a Core asset and verify operationally that it's a Gladius
    attestation.

    `metadata_uri` is optional — if you already know the URI (because
    you stored it off-chain or because TS-side parsing surfaced it),
    pass it here and we'll fetch the JSON. Otherwise the JSON is left
    None and you can pull it later via the TypeScript SDK or by
    parsing the asset account data with mpl-core libraries.

    Raises VerifyError on the unrecoverable failures: account missing,
    wrong owner program. Returns the verification record otherwise.
    """
    expected_ua = derive_gladius_config_pda(program_id)

    own_client = http is None
    client = http or httpx.AsyncClient(timeout=10.0)
    try:
        # getAccountInfo via JSON-RPC.
        resp = await client.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [asset_pubkey, {"encoding": "base64"}],
            },
        )
        resp.raise_for_status()
        payload = resp.json()
        if "error" in payload:
            raise VerifyError(f"rpc error: {payload['error']}")
        value = payload["result"]["value"]
        if value is None:
            raise VerifyError(f"asset {asset_pubkey} not found at {rpc_url}")
        owner = value["owner"]
        if owner != MPL_CORE_PROGRAM_ID:
            raise VerifyError(
                f"asset is owned by {owner}, expected mpl-core {MPL_CORE_PROGRAM_ID}"
            )
        data_b64, _enc = value["data"][0], value["data"][1]

        metadata: dict[str, Any] | None = None
        if metadata_uri:
            try:
                meta_resp = await client.get(metadata_uri)
                if meta_resp.status_code < 400:
                    metadata = meta_resp.json()
            except (httpx.HTTPError, ValueError):
                metadata = None
    finally:
        if own_client:
            await client.aclose()

    return AttestationVerification(
        asset=asset_pubkey,
        owner_program=owner,
        expected_update_authority=expected_ua,
        raw_data_b64=data_b64,
        metadata=metadata,
    )
