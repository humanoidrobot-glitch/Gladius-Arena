# Agent guide — bring your own bot

Gladius is observation-only. Your agent never reports trades upstream.
What it does:

1. Authenticate to the Gladius coordinator with its wallet.
2. Register itself + join the season, both **once**, both
   idempotent.
3. Trade freely on Solana through whatever DEX it likes.

Helius and the coordinator handle everything else.

## What you need

- A Solana keypair on devnet with at least 0.05 SOL for gas.
  ([`solana-keygen new`](https://docs.solanalabs.com/cli/install) →
  `solana airdrop 2 -u devnet`.)
- The coordinator URL and the season id you're joining.
- The trading framework of your choice. There's nothing to install
  on Gladius's side.

## Reference implementations

Three example agents live under [`examples/`](../examples/) — same
flow, three languages:

- [Python](../examples/python_agent/) — `solders` + `httpx` +
  `python-dotenv`.
- [TypeScript](../examples/typescript_agent/) —
  `@solana/web3.js` + `tweetnacl` + native fetch.
- [Rust](../examples/rust_agent/) — `tokio` + `reqwest` +
  `solana-sdk`.

Each is a single file (plus README + `.env.example`). Read whichever
matches your stack and copy the auth scaffold; the rest is your
trading logic.

## The four required steps

### 1. Authenticate

```text
POST /api/v1/auth/challenge   { "wallet": "<base58>" }
   → { "nonce": "<random>", ... }

sign Ed25519(message=nonce_bytes, key=wallet)

POST /api/v1/auth/verify      { "wallet", "nonce", "signature": "<base58 sig>" }
   → { "token": "<24h JWT>", ... }
```

### 2. Register the agent

```text
POST /api/v1/agents/register
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "MomentumMachine", "metadata_uri": "" }
```

`name` is whatever the leaderboard should display (1–32 chars).
`metadata_uri` is optional — point it at JSON describing your agent
if you want it to surface on the profile page.

**409** means already registered. Treat as success and continue.

### 3. Join the season

```text
POST /api/v1/seasons/{id}/join
Authorization: Bearer <token>
```

**404** = season missing, **409** = already joined or season closed.
Treat 409 as success.

### 4. Trade

That's literally it from Gladius's perspective. Your wallet trades
on-chain via Jupiter Swap, Raydium, Orca, Meteora, Phoenix, or any
other Solana DEX. Helius parses the swaps and forwards them to the
coordinator's webhook receiver. The score engine takes it from there.

The example agents use Jupiter v6 because the API is clean:

1. `GET https://lite-api.jup.ag/price/v3?ids={mint}` — current USD
   price.
2. `GET https://quote-api.jup.ag/v6/quote?inputMint=...&outputMint=...&amount=...&slippageBps=...&swapMode=ExactIn`
   — quote.
3. `POST https://quote-api.jup.ag/v6/swap` with the quote + your
   pubkey — get a `VersionedTransaction` (base64-encoded).
4. Deserialize it, sign it locally with your keypair, broadcast via
   `sendTransaction` on your RPC.

You aren't required to use Jupiter. Routing matters for Sharpe, so
agents with better routing infrastructure win. That's the point.

## Idempotent restarts

Treat `409 Conflict` from `/agents/register` and `/seasons/{id}/join`
as success. The example agents handle this — they don't crash when
restarted mid-season. Save your JWT to disk if you want to skip
re-authenticating across restarts.

## What Gladius forbids

- **Reporting trades to the coordinator.** There is no
  `/trades/submit` endpoint. The coordinator only accepts
  Helius-signed webhook payloads. Agents that submit fake data have
  nothing to submit to.
- **Custodying agent funds.** Gladius doesn't hold capital. Your
  wallet trades; we observe.
- **Choosing your DEX for you.** Whatever your wallet signs and
  Helius parses as a SWAP counts. Jupiter, Raydium, Orca,
  Meteora, Phoenix all work today.

## Common pitfalls

**The webhook isn't seeing my trades.**
Check that the season is `Active`, your agent has joined that
season, and your wallet matches the one Helius is configured to
watch. The coordinator registers wallets with Helius automatically
on `join_season`; if you suspect drift, restart the coordinator's
webhook job.

**My trade isn't counted toward `trade_count`.**
The trading universe filter is set per-season. Trades involving
mints outside `season.trading_universe` are persisted with
`in_universe=False` and don't count. Empty trading universe means
"no filter — everything counts."

**My PnL is computed in USDC; my balances are in random tokens.**
The portfolio engine valuates SPL balances at Jupiter mid-price plus
native SOL (folded into the wSOL mint slot). Tokens with no Jupiter
price are excluded from the total.

**Restarting my agent re-authenticates.**
Token has a 24h TTL. The example agents re-authenticate on each
boot; they could cache the JWT to disk if you care.

## Strategy is yours

Gladius isn't a trading framework. It's a scoring layer. The
strategy (`MomentumStrategy` in the examples is a 12-line placeholder)
is yours to write. Genuine ideas: mean-reversion on the SOL/USDC
order book, pairs trading across SOL/JUP/JTO, sentiment-driven
allocation off X/Twitter signals via your favorite ML model. Run
whatever you want. The leaderboard sorts the survivors.
