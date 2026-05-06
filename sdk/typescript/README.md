# @gladius/verify

Verify Gladius performance attestations from any Solana app.

The protocol's value proposition is composability — vaults gating by
reputation, copy-trading platforms following ranked agents, DAOs
scoring contributors. This SDK is the one-call tool that lets those
apps prove an attestation is real Gladius output without trusting any
HTTP API.

## Install

```bash
npm install @gladius/verify @metaplex-foundation/umi-bundle-defaults
```

## Use

```ts
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { verifyAttestation, readAttribute } from "@gladius/verify";

const umi = createUmi("https://api.devnet.solana.com");
const assetPubkey = publicKey("...");  // the attestation asset address

const result = await verifyAttestation(umi, assetPubkey);

if (!result.ok) {
  console.log("not a valid Gladius attestation:", result.reason);
  return;
}

console.log("Season:",     readAttribute(result.metadata, "Season"));
console.log("Final PnL:",  readAttribute(result.metadata, "Final PnL"));
console.log("Sharpe:",     readAttribute(result.metadata, "Sharpe Ratio"));
console.log("Rank:",       readAttribute(result.metadata, "Rank"));
console.log("Owner:",      result.asset.owner.toString());
```

## What gets verified

`verifyAttestation` returns `ok: true` only when:

1. The asset account exists and is a Metaplex Core asset.
2. Its `updateAuthority` equals the Gladius `gladius_config` PDA —
   proving Gladius minted it.
3. The `FreezeDelegate` plugin is set and `frozen === true` — proving
   the credential can't be sold or laundered.

Failure modes return `{ ok: false, reason }` with one of:

- `asset_not_found` — RPC returned no account at that pubkey.
- `wrong_update_authority` — asset is real but wasn't minted by
  Gladius (or you passed the wrong program ID).
- `missing_freeze_plugin` — Gladius always attaches FreezeDelegate;
  if it's missing, this asset isn't a Gladius attestation.
- `freeze_plugin_unfrozen` — same plugin is present but the credential
  has been thawed (Gladius doesn't do this; if it ever happens it's
  a sign of a forked/unsafe deployment).

## Devnet vs mainnet

Default program ID is the devnet deployment
(`6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA`). For a different
deployment (e.g. a future mainnet release), pass `programId`:

```ts
const result = await verifyAttestation(umi, assetPubkey, {
  programId: publicKey("MAINNET_PROGRAM_ID_HERE"),
});
```

## Skipping the metadata fetch

If you're only checking provenance and don't care about the JSON:

```ts
const result = await verifyAttestation(umi, asset, { fetchMetadata: false });
```

Saves one HTTP call to the IPFS/Arweave gateway.
