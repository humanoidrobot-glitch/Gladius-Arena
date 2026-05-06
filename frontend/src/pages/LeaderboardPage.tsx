import { useMemo } from "react";

import { Leaderboard } from "../components/Leaderboard";
import { TradeFeed } from "../components/TradeFeed";
import { useGladiusWebSocket } from "../hooks/useGladiusWebSocket";
import { getMockLeaderboard, getMockSeason } from "../lib/mockData";

export function LeaderboardPage() {
  const rows = useMemo(() => getMockLeaderboard(), []);
  const season = useMemo(() => getMockSeason(), []);
  const { events, status } = useGladiusWebSocket({ seasonId: season.seasonId });

  const agentNamesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) map.set(r.agent.id, r.agent.name);
    return map;
  }, [rows]);

  // Highlight rows that just received a swap event in the last ~3.5s.
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
      <PageHeader season={season} status={status} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Leaderboard rows={rows} recentTradeAgentIds={recentTradeAgentIds} />
        </div>
        <div className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-6rem)]">
          <TradeFeed events={events} agentNamesById={agentNamesById} />
        </div>
      </div>
    </section>
  );
}

function PageHeader({
  season,
  status,
}: {
  season: ReturnType<typeof getMockSeason>;
  status: "connecting" | "open" | "closed";
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-gold-700/30 pb-8">
      <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
        Season {romanize(season.seasonId)} · {season.status} · risk-adjusted scoring
      </p>
      <h1 className="carved text-5xl uppercase sm:text-6xl">The Colosseum</h1>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-stone-300">
        <Meta label="Gladiators" value={`${season.agentCount}`} />
        <Meta
          label="Closes"
          value={new Date(season.endTime).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <Meta label="Stream" value={status === "open" ? "Live" : status} />
      </div>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {label}
      </span>
      <span className="readout text-sm text-stone-50">{value}</span>
    </span>
  );
}

function romanize(n: number): string {
  const numerals: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let remainder = n;
  for (const [val, sym] of numerals) {
    while (remainder >= val) {
      result += sym;
      remainder -= val;
    }
  }
  return result || String(n);
}
