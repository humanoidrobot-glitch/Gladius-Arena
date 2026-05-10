#!/usr/bin/env python3
"""Create a Gladius season as the configured admin.

Runs the full Ed25519 challenge/sign/verify handshake from the admin
keypair, then POSTs the season config. Self-contained — only needs
`solders` and `httpx` from PyPI; no dependency on the example agent's
package.

Usage (PowerShell):

  python scripts/create_season.py `
    --keypair $env:USERPROFILE\.config\solana\id.json `
    --coordinator https://gladius-arena-production.up.railway.app `
    --name "Phase II Devnet" `
    --description "Second arena — risk-adjusted on SOL/USDC" `
    --duration-days 7 `
    --max-agents 50

Defaults: coordinator from $GLADIUS_COORDINATOR_URL, keypair from
$GLADIUS_ADMIN_KEYPAIR (or ~/.config/solana/id.json), trading universe
= [SOL, USDC], scoring_method = risk_adjusted, duration = 7 days.

Setup once:

  pip install solders httpx
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx  # type: ignore[import-not-found]
from solders.keypair import Keypair  # type: ignore[import-not-found]


SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"


def load_keypair(path: Path) -> Keypair:
    raw = json.loads(path.read_text())
    if not isinstance(raw, list):
        raise SystemExit(
            f"keypair file {path} is not a JSON array — expected solana-keygen output"
        )
    return Keypair.from_bytes(bytes(raw))


def authenticate(client: httpx.Client, base: str, kp: Keypair) -> str:
    pubkey = str(kp.pubkey())
    challenge = client.post(f"{base}/api/v1/auth/challenge", json={"wallet": pubkey})
    challenge.raise_for_status()
    nonce: str = challenge.json()["nonce"]

    signature = kp.sign_message(nonce.encode("utf-8"))
    verify = client.post(
        f"{base}/api/v1/auth/verify",
        json={"wallet": pubkey, "nonce": nonce, "signature": str(signature)},
    )
    verify.raise_for_status()
    return verify.json()["token"]


def create_season(
    client: httpx.Client,
    base: str,
    token: str,
    payload: dict[str, object],
) -> dict[str, object]:
    resp = client.post(
        f"{base}/api/v1/seasons",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    if resp.status_code != 201:
        raise SystemExit(f"create_season failed: {resp.status_code} {resp.text}")
    return resp.json()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument(
        "--keypair",
        default=os.environ.get(
            "GLADIUS_ADMIN_KEYPAIR",
            str(Path.home() / ".config" / "solana" / "id.json"),
        ),
        help="path to a Solana keypair JSON file (admin wallet)",
    )
    parser.add_argument(
        "--coordinator",
        default=os.environ.get(
            "GLADIUS_COORDINATOR_URL", "http://localhost:8000"
        ),
        help="coordinator base URL",
    )
    parser.add_argument("--name", required=True, help="season name (1-64 chars)")
    parser.add_argument("--description", default="", help="season description")
    parser.add_argument(
        "--max-agents", type=int, default=50, help="participant cap"
    )
    parser.add_argument(
        "--duration-days",
        type=float,
        default=7.0,
        help="season duration in days (sets end_time = now + duration)",
    )
    parser.add_argument(
        "--scoring-method",
        choices=["pnl", "sharpe", "risk_adjusted"],
        default="risk_adjusted",
    )
    parser.add_argument(
        "--trading-universe",
        default=f"{SOL_MINT},{USDC_MINT}",
        help="comma-separated mint pubkeys (empty string = open universe)",
    )
    args = parser.parse_args()

    keypair_path = Path(args.keypair).expanduser()
    if not keypair_path.is_file():
        raise SystemExit(f"keypair not found: {keypair_path}")

    kp = load_keypair(keypair_path)
    print(f"[admin] {kp.pubkey()}")
    print(f"[coordinator] {args.coordinator}")

    end_time = int(time.time() + args.duration_days * 86400)
    universe = [m.strip() for m in args.trading_universe.split(",") if m.strip()]

    payload = {
        "name": args.name,
        "description": args.description,
        "trading_universe": universe,
        "max_agents": args.max_agents,
        "scoring_method": args.scoring_method,
        "end_time": end_time,
    }

    with httpx.Client(timeout=15.0) as client:
        token = authenticate(client, args.coordinator, kp)
        print("[auth] JWT issued")
        season = create_season(client, args.coordinator, token, payload)

    print()
    print(f"[season] id_onchain  : {season['season_id_onchain']}")
    print(f"[season] name         : {season['name']}")
    print(f"[season] status       : {season['status']}")
    print(f"[season] max_agents   : {season['max_agents']}")
    print(f"[season] end_time     : {season['end_time']}")
    print(f"[season] universe     : {season['trading_universe']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
