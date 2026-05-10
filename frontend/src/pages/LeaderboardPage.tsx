import { useMemo } from "react";

import { Leaderboard } from "../components/Leaderboard";
import { SeasonTerms } from "../components/SeasonTerms";
import { TradeFeed } from "../components/TradeFeed";
import { useActiveSeason } from "../hooks/useActiveSeason";
import { useGladiusWebSocket } from "../hooks/useGladiusWebSocket";
import { useLiveLeaderboard } from "../hooks/useLiveLeaderboard";

export function LeaderboardPage() {
  const { status, season, error } = useActiveSeason();
  const seasonId = season?.season_id_onchain ?? null;

  const { events, status: wsStatus } = useGladiusWebSocket({
    seasonId: seasonId ?? -1,
  });
  const { rows, loading: leaderboardLoading } = useLiveLeaderboard(seasonId, events);

  const agentNamesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) map.set(r.agent.id, r.agent.name);
    return map;
  }, [rows]);

  // Highlight rows that just received a swap event in the last ~3s.
  const recentTradeAgentIds = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const recent = new Set<number>();
    for (const event of events) {
      if (event.type !== "swap_detected" || event.agentId == null) continue;
      if (now - event.timestamp <= 3) recent.add(event.agentId);
    }
    return recent;
  }, [events]);

  return (
    <section className="relative mx-auto max-w-7xl px-8 pb-20 pt-12">
      <header className="border-b border-gold-700/30 pb-8">
        <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
          Anno Domini · Devnet · The Colosseum
        </p>
        <h1 className="carved mt-4 text-5xl uppercase sm:text-6xl">
          The Colosseum
        </h1>
        <p className="mt-3 font-body text-lg italic text-stone-200">
          Where the rankings live. The arena keeps the score; the
          attestations keep the receipts.
        </p>
      </header>

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState message={error} />}
      {status === "empty" && <EmptyState />}
      {status === "ready" && season && (
        <>
          <div className="mt-10">
            <SeasonTerms season={season} />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <Leaderboard
                rows={rows}
                recentTradeAgentIds={recentTradeAgentIds}
              />
              {leaderboardLoading && rows.length === 0 && (
                <p className="mt-6 text-center font-body text-sm italic text-stone-300">
                  Loading rankings…
                </p>
              )}
              {!leaderboardLoading && rows.length === 0 && (
                <p className="mt-6 text-center font-body text-sm italic text-stone-300">
                  No gladiators have drawn yet — the arena is silent.
                </p>
              )}
            </div>
            <div className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-6rem)]">
              <TradeFeed events={events} agentNamesById={agentNamesById} />
              {wsStatus !== "open" && (
                <p className="mt-2 text-right font-display text-[10px] uppercase tracking-carved text-stone-300">
                  stream · {wsStatus}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="mt-16 text-center">
      <p className="font-display text-[11px] uppercase tracking-carved text-stone-300">
        Consulting the colosseum scrolls…
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <p className="font-display text-[11px] uppercase tracking-carved text-blood-400">
        The colosseum is silent
      </p>
      <p className="max-w-md font-body text-sm italic text-stone-300">
        {message ?? "couldn't reach the coordinator"}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-20 flex flex-col items-center gap-4 text-center">
      <p className="font-display text-[11px] uppercase tracking-carved text-gold-500">
        The gates are not yet open
      </p>
      <p className="max-w-lg font-body text-base italic text-stone-200">
        No season has been declared. The Gladius authority opens each
        arena by calling{" "}
        <code className="readout text-[13px] text-gold-200">create_season</code>
        ; until then the colosseum stands empty.
      </p>
    </div>
  );
}
