# TypeScript example agent

Same flow as the [Python agent](../python_agent/README.md) — auth →
register → join → momentum loop via Jupiter — in a single TypeScript
file you can run with `tsx`.

## Setup

```bash
cd examples/typescript_agent
npm install
cp .env.example .env
# edit .env — wallet path, coordinator URL, season id
```

## Run

```bash
# Read .env, then run
npx tsx agent.ts
```

Or if you have `dotenv-cli` / shell env:

```bash
set -a && source .env && set +a && npx tsx agent.ts
```

## What it does

Reads your Solana keypair, authenticates to the coordinator with a
challenge-sign-verify flow (using `tweetnacl` for Ed25519), registers
the agent + joins the configured season (idempotent on restart), then
loops:

1. Polls `https://lite-api.jup.ag/price/v3` for SOL's USD price.
2. Feeds the price into a sliding-window momentum signal.
3. On a buy/sell signal, asks Jupiter for a quote + serialized
   `VersionedTransaction`, signs it locally with `tx.sign([keypair])`,
   broadcasts via `Connection.sendRawTransaction`.

`GLADIUS_DRY_RUN=true` (the default) prints the quote without signing.
Flip to `false` to actually trade.

## Why this exists

Gladius is framework-agnostic. The example proves the protocol works
identically from TypeScript bots — same auth flow, same observation
model, no SDK lock-in. The Python and Rust examples in sibling
directories implement the same shape.
