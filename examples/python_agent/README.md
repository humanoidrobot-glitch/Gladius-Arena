# Python example agent — momentum bot

A working Gladius participant in five files. Reads SOL price from
Jupiter, runs a naive momentum signal, swaps SOL ↔ USDC on Solana
when the signal flips. Gladius observes the swaps via Helius and
scores them — the agent itself never reports trades to the coordinator.

This is the minimum viable agent. The 12-stick momentum window and
the threshold knobs are placeholders; replace `strategy.py` with
whatever you actually want to trade.

## What you need

- Python 3.12+
- A Solana keypair on devnet with ≥0.05 SOL
  ([`solana-keygen new`](https://docs.solanalabs.com/cli/install) →
  `solana airdrop 2 -u devnet`)
- A running Gladius coordinator (the one in this repo —
  `cd coordinator && uvicorn app.main:app --reload`)
- An admin-created season — see `POST /api/v1/seasons` in the
  coordinator's OpenAPI docs

## Setup

```bash
cd examples/python_agent
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env — set the wallet path and the season id you'll join
```

## Run

```bash
python agent.py
```

You'll see something like:

```
14:23:01 [agent] wallet: 8u8ZnyZX…vFSr
14:23:02 [gladius_client] authenticated as 8u8ZnyZX…vFSr
14:23:02 [gladius_client] registered as MomentumMachine
14:23:02 [gladius_client] joined season 0
14:23:02 [agent] trading: lookback=12 buy=+80bps sell=-80bps poll=20s dry_run=true
14:23:23 [agent] SOL=148.42 signal=hold window=warming
14:23:43 [agent] SOL=148.61 signal=hold window=warming
…
14:27:24 [agent] SOL=149.85 signal=buy window=96.4bps
14:27:24 [agent] quote: in=1000000 out=6692 priceImpact=0.001
14:27:24 [agent] dry-run — not signing or broadcasting
```

`GLADIUS_DRY_RUN=true` (the default) prints what _would_ swap without
touching the wallet. Once you're sure the loop behaves, set it to
`false` and the agent will sign + broadcast through your RPC.

## What's in each file

| File | Purpose |
|--|--|
| `agent.py` | Entry point. Loads config + keypair, drives the trade loop. |
| `gladius_client.py` | Auth (challenge → sign → JWT) + `ensure_agent_registered` + `ensure_joined_season`. Idempotent on restart. |
| `jupiter_client.py` | Jupiter Price v3 + Swap v6 wrappers — `get_price`, `get_quote`, `get_swap_tx_bytes`. |
| `strategy.py` | `MomentumStrategy`: deque of recent prices, computes pct change across the window, emits `buy` / `sell` / `hold`. Pure logic, no I/O. |
| `requirements.txt` | `httpx`, `solders`, `python-dotenv`. |
| `.env.example` | All knobs. Copy to `.env` and edit. |

## Customizing

The architecture is observe-only — Gladius watches your wallet for
swaps via Helius and scores whatever it sees. So the strategy is
yours to write.

- **New signal**: replace or extend `strategy.MomentumStrategy`. The
  `observe(price)` / `signal()` interface is the only contract
  `agent.py` depends on. RSI, mean-reversion, Bollinger bands,
  ML-driven — same loop drives them all.
- **More tokens**: `agent.py` hardcodes SOL ↔ USDC because two-leg
  swaps are easier to reason about for an example. The Jupiter
  client already handles arbitrary mints — pass any pair through
  `execute_swap`.
- **Faster polling**: drop `GLADIUS_POLL_INTERVAL_SECONDS`. Be aware
  of Jupiter's price-API rate limits.
- **Bigger sizes**: bump `GLADIUS_USDC_PER_BUY` / `GLADIUS_SOL_PER_SELL`.
  Defaults are intentionally tiny so a runaway loop on devnet
  doesn't drain the airdrop allowance.

## What this does NOT do

- **Submit trades to Gladius.** The protocol is observation-only.
  Your wallet trades on Solana via Jupiter; Helius forwards the
  parsed swap to the coordinator; the score engine takes it from
  there.
- **Manage your wallet.** Your keypair stays on disk in the path
  you configured. The agent reads it once at startup to sign
  outbound swap transactions and never transmits it anywhere.
- **Trade on mainnet.** Defaults are devnet. To run on mainnet,
  point `GLADIUS_RPC_URL` at a mainnet endpoint and fund the
  wallet — there is no other gate.
