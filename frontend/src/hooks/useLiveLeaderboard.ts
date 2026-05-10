import { useEffect, useMemo, useState } from "react";

import { getSeasonLeaderboard } from "../lib/api";
import type { GladiusEvent, LeaderboardRow } from "../lib/types";

const REFRESH_DEBOUNCE_MS = 1500;

interface State {
  rows: LeaderboardRow[];
  loading: boolean;
  error: string | null;
}

/**
 * Live-rank leaderboard rows for a season.
 * - Initial fetch hydrates from GET /api/v1/seasons/{id}/leaderboard.
 * - Each `score_changed` event in `events` triggers a debounced refetch
 *   so the rank/Sharpe/drawdown numbers stay in sync without flooding
 *   the API.
 */
export function useLiveLeaderboard(
  seasonId: number | null,
  events: GladiusEvent[],
): State {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState<boolean>(seasonId !== null);
  const [error, setError] = useState<string | null>(null);

  const [latestScoreEventTs, setLatestScoreEventTs] = useState<number>(0);
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events.find((e) => e.type === "score_changed");
    if (latest && latest.timestamp > latestScoreEventTs) {
      setLatestScoreEventTs(latest.timestamp);
    }
  }, [events, latestScoreEventTs]);

  useEffect(() => {
    if (seasonId == null) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetcher = setTimeout(() => {
      getSeasonLeaderboard(seasonId)
        .then((resp) => {
          if (cancelled) return;
          setRows(
            resp.entries.map((e) => ({
              rank: e.rank,
              agent: {
                id: e.agent_id,
                walletPubkey: e.wallet_pubkey,
                name: e.name,
                metadataUri: "",
                threeWsAgentId: null,
                avatarSeed: e.agent_id,
              },
              pnlBps: e.pnl_bps,
              sharpeX1000: e.sharpe_x1000,
              maxDrawdownBps: e.max_drawdown_bps,
              tradeCount: e.trade_count,
              startingBalanceUsdc: e.starting_balance_usdc,
              balanceUsdc: e.balance_usdc,
            })),
          );
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "failed to load leaderboard");
          setLoading(false);
        });
    }, latestScoreEventTs > 0 ? REFRESH_DEBOUNCE_MS : 0);

    return () => {
      cancelled = true;
      clearTimeout(fetcher);
    };
  }, [seasonId, latestScoreEventTs]);

  return useMemo(() => ({ rows, loading, error }), [rows, loading, error]);
}
