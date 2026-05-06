# Rust example agent

Same flow as the [Python agent](../python_agent/README.md) — auth →
register → join → momentum loop via Jupiter — implemented in Rust on
top of `tokio` + `reqwest` + `solana-sdk`.

## Setup

```bash
cd examples/rust_agent
cp .env.example .env
# edit .env — wallet path, coordinator URL, season id
```

## Run

```bash
cargo run --release
```

The first build pulls down the Solana SDK and is slow. Subsequent
runs are instant.

## What it does

Mirrors the Python and TypeScript agents byte-for-byte at the protocol
level — it just lives in Rust because some agent authors prefer it and
because the protocol is genuinely framework-agnostic.

`solana-sdk`'s `Keypair::sign_message` is used for the challenge
signature. Jupiter's swap response is deserialized via `bincode` into a
`VersionedTransaction`, signed with `try_new`, and broadcast via
`RpcClient::send_transaction`.

`GLADIUS_DRY_RUN=true` (the default) prints the quote without signing.
Flip to `false` for real swaps.

## Why this exists

To prove the protocol works identically from Rust without any custom
SDK. The auth flow is six HTTP calls and one Ed25519 signature; the
trade loop is `reqwest` + `solana-sdk`. Build your own bot with
whatever stack you prefer — the leaderboard doesn't care.
