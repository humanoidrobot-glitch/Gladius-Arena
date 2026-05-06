import type { Agent, GladiusEvent, LeaderboardRow, SeasonSummary } from "./types";

// A real season pulls Agent.name (free-form 1-32 chars) — owners pick
// whatever they want. Mix Roman-flavored picks with framework / handle
// styles so the spectrum is visible.
const NAMES = [
  "Hadrian",
  "ElizaOS-α",
  "Spartacus",
  "0xJupiter",
  "Aurelius",
  "MomentumMachine",
  "Crixus",
  "Tendies",
  "GOAT-Bot",
  "Caesar's Edge",
  "AlphaWolf 9000",
  "Cornelia",
];

function pubkey(seed: number): string {
  // Pseudo-pubkey for display only — base58-ish but doesn't need to round-trip.
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  let n = seed * 73856093 + 19349663;
  for (let i = 0; i < 44; i++) {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    s += alphabet[n % alphabet.length];
  }
  return s;
}

function makeAgent(i: number): Agent {
  return {
    id: i + 1,
    walletPubkey: pubkey(i + 1),
    name: NAMES[i % NAMES.length],
    metadataUri: "",
    threeWsAgentId: i % 4 === 0 ? `a_${pubkey(i).slice(0, 12)}` : null,
    avatarSeed: i + 1,
  };
}

const RAW_PERFORMANCE = [
  { pnlPct: 52.4, sharpe: 2.14, ddPct: 4.2, trades: 187 },
  { pnlPct: 38.1, sharpe: 1.92, ddPct: 7.8, trades: 142 },
  { pnlPct: 24.5, sharpe: 1.87, ddPct: 3.1, trades: 98 },
  { pnlPct: 18.2, sharpe: 1.55, ddPct: 9.4, trades: 76 },
  { pnlPct: 12.0, sharpe: 1.43, ddPct: 12.4, trades: 64 },
  { pnlPct: 8.7, sharpe: 1.21, ddPct: 6.8, trades: 51 },
  { pnlPct: 4.3, sharpe: 0.92, ddPct: 8.5, trades: 89 },
  { pnlPct: 1.8, sharpe: 0.65, ddPct: 11.2, trades: 42 },
  { pnlPct: 0.4, sharpe: 0.31, ddPct: 5.4, trades: 35 },
  { pnlPct: -2.1, sharpe: -0.18, ddPct: 14.7, trades: 71 },
  { pnlPct: -6.8, sharpe: -0.45, ddPct: 18.3, trades: 56 },
  { pnlPct: -14.2, sharpe: -0.72, ddPct: 22.6, trades: 88 },
];

export function getMockLeaderboard(): LeaderboardRow[] {
  return RAW_PERFORMANCE.map((perf, i) => {
    const agent = makeAgent(i);
    const startingBalance = 10_000_000_000; // 10,000 USDC
    const balance = Math.round(startingBalance * (1 + perf.pnlPct / 100));
    return {
      rank: i + 1,
      agent,
      pnlBps: Math.round(perf.pnlPct * 100),
      sharpeX1000: Math.round(perf.sharpe * 1000),
      maxDrawdownBps: Math.round(perf.ddPct * 100),
      tradeCount: perf.trades,
      startingBalanceUsdc: startingBalance,
      balanceUsdc: balance,
    };
  });
}

export function getMockSeason(): SeasonSummary {
  return {
    seasonId: 1,
    name: "Inaugural Season",
    status: "active",
    scoringMethod: "risk_adjusted",
    agentCount: 12,
    endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE";
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

const TOKEN_SYMBOLS: Record<string, string> = {
  [SOL_MINT]: "SOL",
  [USDC_MINT]: "USDC",
  [BONK_MINT]: "BONK",
};

const MOCK_PAIRS: Array<[string, string]> = [
  [SOL_MINT, USDC_MINT],
  [USDC_MINT, SOL_MINT],
  [USDC_MINT, BONK_MINT],
  [BONK_MINT, USDC_MINT],
];

export function tokenSymbol(mint: string): string {
  return TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…`;
}

export function makeMockSwapEvent(seq: number): GladiusEvent {
  const leaderboard = getMockLeaderboard();
  const row = leaderboard[seq % leaderboard.length];
  const [tokenIn, tokenOut] = MOCK_PAIRS[seq % MOCK_PAIRS.length];
  const amountInRaw = String((1 + (seq % 9)) * 1_000_000_000);
  const amountOutRaw = String((1 + (seq % 7)) * 100_000_000);
  return {
    version: 1,
    type: "swap_detected",
    seasonId: 1,
    timestamp: Math.floor(Date.now() / 1000),
    agentId: row.agent.id,
    walletPubkey: row.agent.walletPubkey,
    threeWsAgentId: row.agent.threeWsAgentId,
    emotionHint: "curiosity:0.60",
    data: {
      txSignature: `${pubkey(seq + 1000).slice(0, 32)}…`,
      tokenIn,
      tokenOut,
      amountInRaw,
      amountOutRaw,
      inUniverse: true,
    },
  };
}
