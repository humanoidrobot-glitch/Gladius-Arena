import type { LeaderboardRow } from "../lib/types";
import { AgentRow } from "./AgentRow";

interface LeaderboardProps {
  rows: LeaderboardRow[];
  recentTradeAgentIds?: Set<number>;
}

export function Leaderboard({ rows, recentTradeAgentIds }: LeaderboardProps) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <AgentRow
          key={row.agent.id}
          row={row}
          recentTradeFlash={recentTradeAgentIds?.has(row.agent.id)}
        />
      ))}
    </div>
  );
}
