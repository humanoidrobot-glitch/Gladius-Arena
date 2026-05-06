# gladius-verify (Python)

Verify Gladius performance attestations from any Python app.

The TypeScript SDK (`sdk/typescript/`) is the full-fat verifier — it
uses `@metaplex-foundation/mpl-core` to deserialize the asset's
on-chain data and surface the structured plugin / metadata fields.
Python doesn't have a maintained mpl-core deserializer, so this SDK
does the operationally meaningful checks (account exists, owned by
mpl-core, metadata JSON fetched + parsed) and exposes the raw account
bytes for downstream tooling.

## Install

```bash
pip install gladius-verify
```

## Use

```python
import asyncio
from gladius_sdk import verify_attestation

async def main():
    record = await verify_attestation(
        asset_pubkey="...",                          # attestation asset address
        metadata_uri="ipfs://...",                   # if you know it; optional
        rpc_url="https://api.devnet.solana.com",
    )
    print("owner program:    ", record.owner_program)
    print("expected update_a:", record.expected_update_authority)
    print("metadata:         ", record.metadata)

asyncio.run(main())
```

## What gets verified

Operationally:

1. The account exists at the given pubkey on the given RPC.
2. Its `owner` program is the deployed mpl-core program
   (`CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`).
3. The `expected_update_authority` is computed deterministically
   from the Gladius program ID — the caller checks this matches the
   asset's actual update authority by parsing the raw asset bytes
   themselves (or by deferring to the TypeScript SDK over IPC if
   they only have Python in their stack).

## What's deferred to TypeScript

Parsing the binary mpl-core asset account into structured fields
(`name`, `uri`, `owner`, `updateAuthority`, `freezeDelegate.frozen`).
The TypeScript SDK does this in one call. Python users who need the
fields have three options:

1. Use the TypeScript SDK and shell out from Python.
2. Use the metadata URI fetched here as the source of truth for the
   attestation attributes (the JSON has Final PnL / Sharpe / Drawdown
   / Rank / etc. directly).
3. Hand-roll a Borsh parser against the mpl-core asset layout.

For most analytics use cases, option 2 is enough — the metadata JSON
is the public record of the attestation's contents.
