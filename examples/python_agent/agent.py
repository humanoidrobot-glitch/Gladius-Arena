"""Gladius example agent — momentum trader on devnet.

Flow:
1. Authenticate to the Gladius coordinator with the wallet keypair.
2. Register the agent + join the configured season (idempotent).
3. Loop: poll SOL price from Jupiter, feed momentum strategy, on a
   buy/sell signal request a Jupiter swap, sign the returned tx with
   the wallet keypair, broadcast it to Solana RPC. Gladius observes
   the resulting on-chain swap via Helius webhooks — the agent
   never reports trades to the coordinator.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import sys
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

import httpx
from dotenv import load_dotenv
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction

from gladius_client import GladiusClient
from jupiter_client import JupiterClient
from strategy import MomentumStrategy

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"
SOL_DECIMALS = 9
USDC_DECIMALS = 6

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("agent")


@dataclass
class Config:
    wallet_path: Path
    coordinator_url: str
    rpc_url: str
    season_id: int
    agent_name: str
    lookback: int
    buy_threshold_bps: int
    sell_threshold_bps: int
    poll_interval_seconds: int
    usdc_per_buy: Decimal
    sol_per_sell: Decimal
    slippage_bps: int
    dry_run: bool


def load_config() -> Config:
    load_dotenv()
    raw_path = os.environ.get("GLADIUS_AGENT_WALLET_PATH", "~/.config/solana/id.json")
    return Config(
        wallet_path=Path(os.path.expanduser(raw_path)),
        coordinator_url=os.environ.get("GLADIUS_COORDINATOR_URL", "http://localhost:8000"),
        rpc_url=os.environ.get("GLADIUS_RPC_URL", "https://api.devnet.solana.com"),
        season_id=int(os.environ.get("GLADIUS_SEASON_ID", "0")),
        agent_name=os.environ.get("GLADIUS_AGENT_NAME", "MomentumMachine"),
        lookback=int(os.environ.get("GLADIUS_LOOKBACK_SAMPLES", "12")),
        buy_threshold_bps=int(os.environ.get("GLADIUS_BUY_THRESHOLD_BPS", "80")),
        sell_threshold_bps=int(os.environ.get("GLADIUS_SELL_THRESHOLD_BPS", "80")),
        poll_interval_seconds=int(os.environ.get("GLADIUS_POLL_INTERVAL_SECONDS", "20")),
        usdc_per_buy=Decimal(os.environ.get("GLADIUS_USDC_PER_BUY", "1.0")),
        sol_per_sell=Decimal(os.environ.get("GLADIUS_SOL_PER_SELL", "0.01")),
        slippage_bps=int(os.environ.get("GLADIUS_SLIPPAGE_BPS", "100")),
        dry_run=os.environ.get("GLADIUS_DRY_RUN", "true").lower() == "true",
    )


def load_keypair(path: Path) -> Keypair:
    raw = path.read_text()
    secret = json.loads(raw)
    return Keypair.from_bytes(bytes(secret))


async def send_raw_transaction(
    http: httpx.AsyncClient, rpc_url: str, signed_bytes: bytes
) -> str:
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendTransaction",
        "params": [
            base64.b64encode(signed_bytes).decode("ascii"),
            {"encoding": "base64", "skipPreflight": False, "maxRetries": 3},
        ],
    }
    resp = await http.post(rpc_url, json=body, timeout=30.0)
    resp.raise_for_status()
    payload = resp.json()
    if "error" in payload:
        raise RuntimeError(f"sendTransaction error: {payload['error']}")
    return payload["result"]


async def execute_swap(
    *,
    http: httpx.AsyncClient,
    jupiter: JupiterClient,
    keypair: Keypair,
    rpc_url: str,
    input_mint: str,
    output_mint: str,
    amount_raw: int,
    slippage_bps: int,
    dry_run: bool,
) -> str | None:
    quote = await jupiter.get_quote(
        input_mint, output_mint, amount_raw, slippage_bps
    )
    out_amount = quote.get("outAmount")
    logger.info(
        "quote: in=%s out=%s priceImpact=%s",
        amount_raw,
        out_amount,
        quote.get("priceImpactPct"),
    )

    if dry_run:
        logger.info("dry-run — not signing or broadcasting")
        return None

    tx_bytes = await jupiter.get_swap_tx_bytes(quote, str(keypair.pubkey()))
    versioned = VersionedTransaction.from_bytes(tx_bytes)
    signed = VersionedTransaction(versioned.message, [keypair])
    sig = await send_raw_transaction(http, rpc_url, bytes(signed))
    logger.info("submitted tx %s", sig)
    return sig


async def trade_loop(
    cfg: Config,
    http: httpx.AsyncClient,
    keypair: Keypair,
    jupiter: JupiterClient,
    strategy: MomentumStrategy,
) -> None:
    logger.info(
        "trading: lookback=%d buy=+%dbps sell=-%dbps poll=%ds dry_run=%s",
        cfg.lookback,
        cfg.buy_threshold_bps,
        cfg.sell_threshold_bps,
        cfg.poll_interval_seconds,
        cfg.dry_run,
    )

    while True:
        try:
            price = await jupiter.get_price(SOL_MINT)
        except Exception as exc:
            logger.warning("price fetch failed: %s", exc)
            await asyncio.sleep(cfg.poll_interval_seconds)
            continue

        strategy.observe(price)
        signal, change_bps = strategy.signal()
        change_str = f"{change_bps:.1f}bps" if change_bps is not None else "warming"
        logger.info("SOL=%s signal=%s window=%s", price, signal, change_str)

        try:
            if signal == "buy":
                amount_raw = int(cfg.usdc_per_buy * Decimal(10) ** USDC_DECIMALS)
                await execute_swap(
                    http=http,
                    jupiter=jupiter,
                    keypair=keypair,
                    rpc_url=cfg.rpc_url,
                    input_mint=USDC_MINT,
                    output_mint=SOL_MINT,
                    amount_raw=amount_raw,
                    slippage_bps=cfg.slippage_bps,
                    dry_run=cfg.dry_run,
                )
            elif signal == "sell":
                amount_raw = int(cfg.sol_per_sell * Decimal(10) ** SOL_DECIMALS)
                await execute_swap(
                    http=http,
                    jupiter=jupiter,
                    keypair=keypair,
                    rpc_url=cfg.rpc_url,
                    input_mint=SOL_MINT,
                    output_mint=USDC_MINT,
                    amount_raw=amount_raw,
                    slippage_bps=cfg.slippage_bps,
                    dry_run=cfg.dry_run,
                )
        except Exception as exc:
            logger.exception("swap failed: %s", exc)

        await asyncio.sleep(cfg.poll_interval_seconds)


async def main() -> None:
    cfg = load_config()
    keypair = load_keypair(cfg.wallet_path)
    logger.info("wallet: %s", keypair.pubkey())

    async with httpx.AsyncClient(timeout=15.0) as http:
        gladius = GladiusClient(cfg.coordinator_url, http)
        jupiter = JupiterClient(http)

        await gladius.authenticate(keypair)
        await gladius.ensure_agent_registered(cfg.agent_name)
        await gladius.ensure_joined_season(cfg.season_id)

        strategy = MomentumStrategy(
            lookback=cfg.lookback,
            buy_threshold_bps=cfg.buy_threshold_bps,
            sell_threshold_bps=cfg.sell_threshold_bps,
        )
        await trade_loop(cfg, http, keypair, jupiter, strategy)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("stopped")
        sys.exit(0)
