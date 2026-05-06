/**
 * @gladius/verify — verify Gladius performance attestations.
 *
 * The on-chain shape:
 *   - Each attestation is a Metaplex Core asset minted by the Gladius
 *     program (default: 6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA).
 *   - Update authority is the Gladius `gladius_config` PDA, derived
 *     from seeds = ["gladius_config"] under the program ID.
 *   - The FreezeDelegate plugin is set with `frozen=true` so the asset
 *     is non-transferable from day one.
 *   - Asset metadata URI points to JSON with the attestation
 *     attributes (Season, Final PnL, Sharpe, Drawdown, etc.).
 *
 * Other protocols (vaults gating by reputation, copy-trade platforms,
 * DAO contribution scoring) verify all of the above by reading
 * on-chain state and fetching the metadata JSON. This SDK wraps the
 * mpl-core RPC + URI fetch into one call.
 */

import {
  fetchAssetV1,
  type AssetV1,
} from "@metaplex-foundation/mpl-core";
import {
  publicKey,
  type PublicKey,
  type Umi,
} from "@metaplex-foundation/umi";

export const DEFAULT_GLADIUS_PROGRAM_ID = publicKey(
  "6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA",
);

const GLADIUS_CONFIG_SEED = new TextEncoder().encode("gladius_config");

export interface VerifyOptions {
  /** Override the default Gladius program ID (e.g. for a forked deployment). */
  programId?: PublicKey;
  /** Fetch + parse the metadata URI JSON. Default `true`. */
  fetchMetadata?: boolean;
  /** httpx-style fetch override for tests. Default global `fetch`. */
  fetcher?: typeof fetch;
}

export interface AttestationMetadataAttribute {
  trait_type: string;
  value: string | number;
}

export interface AttestationMetadata {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: AttestationMetadataAttribute[];
  [key: string]: unknown;
}

export type VerifyFailureReason =
  | "asset_not_found"
  | "wrong_update_authority"
  | "missing_freeze_plugin"
  | "freeze_plugin_unfrozen";

export interface VerifyFailure {
  ok: false;
  reason: VerifyFailureReason;
  detail?: string;
}

export interface VerifySuccess {
  ok: true;
  /** The raw mpl-core asset record. */
  asset: AssetV1;
  /** The expected update authority — Gladius `gladius_config` PDA. */
  expectedUpdateAuthority: PublicKey;
  /** Fetched metadata JSON if `fetchMetadata !== false`. */
  metadata?: AttestationMetadata;
}

export type VerifyResult = VerifySuccess | VerifyFailure;

/**
 * Verify a Gladius attestation asset by pubkey.
 *
 * Returns `{ ok: true, asset, metadata? }` if the asset exists, was
 * minted by the Gladius program, and has the FreezeDelegate plugin set
 * frozen=true. Returns `{ ok: false, reason }` otherwise.
 */
export async function verifyAttestation(
  umi: Umi,
  assetPubkey: PublicKey,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const programId = options.programId ?? DEFAULT_GLADIUS_PROGRAM_ID;
  const fetcher = options.fetcher ?? fetch;
  const fetchMetadata = options.fetchMetadata !== false;

  const expectedUpdateAuthority = umi.eddsa.findPda(programId, [
    GLADIUS_CONFIG_SEED,
  ])[0];

  let asset: AssetV1;
  try {
    asset = await fetchAssetV1(umi, assetPubkey);
  } catch (err) {
    return {
      ok: false,
      reason: "asset_not_found",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // updateAuthority on a Core asset is a discriminated union
  // ({ type: 'Address', address } | { type: 'Collection', address } | { type: 'None' }).
  // Gladius mints with a direct Address authority — the gladius_config PDA.
  const ua = asset.updateAuthority;
  const uaPubkey =
    ua.type === "Address" || ua.type === "Collection" ? ua.address : null;
  if (uaPubkey?.toString() !== expectedUpdateAuthority.toString()) {
    return {
      ok: false,
      reason: "wrong_update_authority",
      detail: `expected ${expectedUpdateAuthority.toString()}, got ${
        uaPubkey?.toString() ?? "none"
      }`,
    };
  }

  const freeze = asset.freezeDelegate;
  if (!freeze) {
    return { ok: false, reason: "missing_freeze_plugin" };
  }
  if (!freeze.frozen) {
    return { ok: false, reason: "freeze_plugin_unfrozen" };
  }

  const result: VerifySuccess = {
    ok: true,
    asset,
    expectedUpdateAuthority,
  };

  if (fetchMetadata && asset.uri) {
    try {
      const resp = await fetcher(asset.uri);
      if (resp.ok) {
        result.metadata = (await resp.json()) as AttestationMetadata;
      }
    } catch {
      // Non-fatal — verification still succeeded, metadata is just missing.
    }
  }

  return result;
}

/**
 * Convenience helper: extract a numeric attribute value from the
 * metadata JSON (e.g. "Final PnL", "Sharpe Ratio").
 */
export function readAttribute(
  metadata: AttestationMetadata | undefined,
  trait: string,
): string | number | undefined {
  return metadata?.attributes?.find((a) => a.trait_type === trait)?.value;
}
