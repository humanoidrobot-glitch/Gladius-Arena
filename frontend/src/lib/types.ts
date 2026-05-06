export interface Agent {
  id: number;
  walletPubkey: string;
  name: string;
  metadataUri: string;
  threeWsAgentId: string | null;
  avatarSeed: number;
}

export interface LeaderboardRow {
  rank: number;
  agent: Agent;
  pnlBps: number;
  sharpeX1000: number;
  maxDrawdownBps: number;
  tradeCount: number;
  startingBalanceUsdc: number;
  balanceUsdc: number;
}

export interface SeasonSummary {
  seasonId: number;
  name: string;
  status: "pending" | "active" | "settled" | "cancelled";
  scoringMethod: "pnl" | "sharpe" | "risk_adjusted";
  agentCount: number;
  endTime: number;
}

export type GladiusEventType =
  | "swap_detected"
  | "balance_updated"
  | "score_changed"
  | "season_started"
  | "season_ended";

export interface GladiusEvent {
  version: 1;
  type: GladiusEventType;
  seasonId: number;
  timestamp: number;
  agentId: number | null;
  walletPubkey: string | null;
  threeWsAgentId: string | null;
  emotionHint: string | null;
  data: Record<string, unknown>;
}

export interface SwapEventData {
  txSignature: string;
  tokenIn: string;
  tokenOut: string;
  amountInRaw: string;
  amountOutRaw: string;
  inUniverse: boolean;
}

/** Convenience: pnlBps to a percent number (5000 → 50.0). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}
