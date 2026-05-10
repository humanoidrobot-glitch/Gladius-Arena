/**
 * Tiny token-mint → symbol resolver for the UI. Phase 1 hardcodes the
 * majors that appear in trading universes; unknowns get truncated.
 * Phase 2 should swap to a real Jupiter token-list fetch with caching.
 */

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const JTO_MINT = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL";
const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

export const TOKEN_SYMBOLS: Record<string, string> = {
  [SOL_MINT]: "SOL",
  [USDC_MINT]: "USDC",
  [USDT_MINT]: "USDT",
  [BONK_MINT]: "BONK",
  [JTO_MINT]: "JTO",
  [JUP_MINT]: "JUP",
  [PYTH_MINT]: "PYTH",
};

export function tokenSymbol(mint: string): string {
  return TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}
