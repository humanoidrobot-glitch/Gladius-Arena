/**
 * Gladius example agent (TypeScript) — momentum trader on devnet.
 *
 * Same flow as examples/python_agent: authenticate → register → join →
 * loop polling Jupiter prices → on a momentum signal, sign + send a
 * Jupiter swap. Gladius observes the on-chain swap via Helius.
 *
 * Single-file by design so newcomers can read it top-to-bottom.
 * Run with: `npx tsx agent.ts`.
 */

import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import nacl from "tweetnacl";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE";
const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

interface Config {
  walletPath: string;
  coordinatorUrl: string;
  rpcUrl: string;
  seasonId: number;
  agentName: string;
  lookbackSamples: number;
  thresholdBps: number;
  pollIntervalMs: number;
  usdcPerBuy: number;
  solPerSell: number;
  slippageBps: number;
  dryRun: boolean;
}

function loadConfig(): Config {
  const env = (key: string, fallback: string) => process.env[key] ?? fallback;
  const expandHome = (p: string) =>
    p.startsWith("~") ? resolve(homedir(), p.slice(2)) : resolve(p);
  return {
    walletPath: expandHome(env("GLADIUS_AGENT_WALLET_PATH", "~/.config/solana/id.json")),
    coordinatorUrl: env("GLADIUS_COORDINATOR_URL", "http://localhost:8000"),
    rpcUrl: env("GLADIUS_RPC_URL", "https://api.devnet.solana.com"),
    seasonId: Number(env("GLADIUS_SEASON_ID", "0")),
    agentName: env("GLADIUS_AGENT_NAME", "TypeScriptAgent"),
    lookbackSamples: Number(env("GLADIUS_LOOKBACK_SAMPLES", "12")),
    thresholdBps: Number(env("GLADIUS_THRESHOLD_BPS", "80")),
    pollIntervalMs: Number(env("GLADIUS_POLL_INTERVAL_SECONDS", "20")) * 1000,
    usdcPerBuy: Number(env("GLADIUS_USDC_PER_BUY", "1.0")),
    solPerSell: Number(env("GLADIUS_SOL_PER_SELL", "0.01")),
    slippageBps: Number(env("GLADIUS_SLIPPAGE_BPS", "100")),
    dryRun: env("GLADIUS_DRY_RUN", "true").toLowerCase() === "true",
  };
}

function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

class GladiusClient {
  private token: string | null = null;
  constructor(private base: string) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }

  async authenticate(keypair: Keypair): Promise<void> {
    const wallet = keypair.publicKey.toBase58();
    const challenge = await fetch(`${this.base}/api/v1/auth/challenge`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ wallet }),
    });
    if (!challenge.ok) throw new Error(`challenge: ${challenge.status}`);
    const { nonce } = (await challenge.json()) as { nonce: string };

    const sig = nacl.sign.detached(new TextEncoder().encode(nonce), keypair.secretKey);
    const verify = await fetch(`${this.base}/api/v1/auth/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ wallet, nonce, signature: bs58.encode(sig) }),
    });
    if (!verify.ok) throw new Error(`verify: ${verify.status}`);
    const { token } = (await verify.json()) as { token: string };
    this.token = token;
    console.log("authenticated as", wallet);
  }

  async ensureAgentRegistered(name: string): Promise<void> {
    const resp = await fetch(`${this.base}/api/v1/agents/register`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name, metadata_uri: "" }),
    });
    if (resp.status === 409) {
      console.log("agent already registered — continuing");
      return;
    }
    if (!resp.ok) throw new Error(`register: ${resp.status} ${await resp.text()}`);
    console.log("registered as", name);
  }

  async ensureJoinedSeason(seasonId: number): Promise<void> {
    const resp = await fetch(
      `${this.base}/api/v1/seasons/${seasonId}/join`,
      { method: "POST", headers: this.headers() },
    );
    if (resp.status === 409) {
      console.log(`already in season ${seasonId} — continuing`);
      return;
    }
    if (!resp.ok) throw new Error(`join: ${resp.status} ${await resp.text()}`);
    console.log(`joined season ${seasonId}`);
  }
}

class JupiterClient {
  async getPriceUsd(mint: string): Promise<number> {
    const url = `https://lite-api.jup.ag/price/v3?ids=${mint}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`jupiter price: ${resp.status}`);
    const json = (await resp.json()) as { data: Record<string, { usdPrice?: string; price?: string }> };
    const entry = json.data?.[mint];
    const raw = entry?.usdPrice ?? entry?.price;
    if (!raw) throw new Error(`no price for ${mint}`);
    return Number(raw);
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amountRaw: bigint,
    slippageBps: number,
  ): Promise<unknown> {
    const url =
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}` +
      `&outputMint=${outputMint}&amount=${amountRaw}` +
      `&slippageBps=${slippageBps}&swapMode=ExactIn`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`jupiter quote: ${resp.status}`);
    return resp.json();
  }

  async getSwapTxBase64(quote: unknown, userPubkey: string): Promise<string> {
    const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPubkey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
      }),
    });
    if (!resp.ok) throw new Error(`jupiter swap: ${resp.status}`);
    const json = (await resp.json()) as { swapTransaction: string };
    return json.swapTransaction;
  }
}

class MomentumStrategy {
  private prices: number[] = [];
  constructor(
    private lookback: number,
    private thresholdBps: number,
  ) {}

  observe(price: number): void {
    this.prices.push(price);
    if (this.prices.length > this.lookback) this.prices.shift();
  }

  signal(): { action: "buy" | "sell" | "hold"; changeBps: number | null } {
    if (this.prices.length < this.lookback) return { action: "hold", changeBps: null };
    const first = this.prices[0];
    const last = this.prices[this.prices.length - 1];
    if (first === 0) return { action: "hold", changeBps: null };
    const changeBps = ((last - first) / first) * 10_000;
    if (changeBps >= this.thresholdBps) return { action: "buy", changeBps };
    if (changeBps <= -this.thresholdBps) return { action: "sell", changeBps };
    return { action: "hold", changeBps };
  }
}

async function executeSwap(args: {
  jupiter: JupiterClient;
  connection: Connection;
  keypair: Keypair;
  inputMint: string;
  outputMint: string;
  amountRaw: bigint;
  slippageBps: number;
  dryRun: boolean;
}): Promise<string | null> {
  const quote = await args.jupiter.getQuote(
    args.inputMint, args.outputMint, args.amountRaw, args.slippageBps,
  );
  console.log("quote:", (quote as { outAmount?: string; priceImpactPct?: string }).outAmount,
              "priceImpact:", (quote as { priceImpactPct?: string }).priceImpactPct);

  if (args.dryRun) {
    console.log("dry-run — not signing or broadcasting");
    return null;
  }

  const txBase64 = await args.jupiter.getSwapTxBase64(quote, args.keypair.publicKey.toBase58());
  const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
  tx.sign([args.keypair]);
  const sig = await args.connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  console.log("submitted tx", sig);
  return sig;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const keypair = loadKeypair(cfg.walletPath);
  console.log("wallet:", keypair.publicKey.toBase58());

  const gladius = new GladiusClient(cfg.coordinatorUrl);
  const jupiter = new JupiterClient();
  const connection = new Connection(cfg.rpcUrl, "confirmed");
  const strategy = new MomentumStrategy(cfg.lookbackSamples, cfg.thresholdBps);

  await gladius.authenticate(keypair);
  await gladius.ensureAgentRegistered(cfg.agentName);
  await gladius.ensureJoinedSeason(cfg.seasonId);

  console.log(
    `trading: lookback=${cfg.lookbackSamples} threshold=±${cfg.thresholdBps}bps ` +
      `poll=${cfg.pollIntervalMs / 1000}s dry_run=${cfg.dryRun}`,
  );

  while (true) {
    try {
      const price = await jupiter.getPriceUsd(SOL_MINT);
      strategy.observe(price);
      const { action, changeBps } = strategy.signal();
      const tag = changeBps === null ? "warming" : `${changeBps.toFixed(1)}bps`;
      console.log(`SOL=${price.toFixed(2)} signal=${action} window=${tag}`);

      if (action === "buy") {
        const amountRaw = BigInt(Math.round(cfg.usdcPerBuy * 10 ** USDC_DECIMALS));
        await executeSwap({
          jupiter, connection, keypair,
          inputMint: USDC_MINT, outputMint: SOL_MINT,
          amountRaw, slippageBps: cfg.slippageBps, dryRun: cfg.dryRun,
        });
      } else if (action === "sell") {
        const amountRaw = BigInt(Math.round(cfg.solPerSell * 10 ** SOL_DECIMALS));
        await executeSwap({
          jupiter, connection, keypair,
          inputMint: SOL_MINT, outputMint: USDC_MINT,
          amountRaw, slippageBps: cfg.slippageBps, dryRun: cfg.dryRun,
        });
      }
    } catch (err) {
      console.warn("cycle error:", err instanceof Error ? err.message : err);
    }

    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
