import type { SeasonHistoryRow } from "../../lib/mockData";

interface SeasonHistoryProps {
  rows: SeasonHistoryRow[];
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function SeasonHistory({ rows }: SeasonHistoryProps) {
  return (
    <div className="stone-panel border border-stone-700/40 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gold-700/30 text-left">
            <Th>Season</Th>
            <Th>Status</Th>
            <Th align="right">Rank</Th>
            <Th align="right">PnL</Th>
            <Th align="right">Sharpe</Th>
            <Th align="right">Drawdown</Th>
            <Th align="right">Trades</Th>
            <Th align="right">Settled</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const positive = row.pnlBps >= 0;
            const isLast = i === rows.length - 1;
            return (
              <tr
                key={`${row.seasonId}-${i}`}
                className={`${isLast ? "" : "border-b border-stone-700/30"} transition-colors hover:bg-night-700/30`}
              >
                <Td>
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-base text-gold-200">
                      {ROMAN[row.seasonId] ?? String(row.seasonId + 1)}
                    </span>
                    <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
                      Season
                    </span>
                  </span>
                </Td>
                <Td>
                  <StatusPill status={row.status} />
                </Td>
                <Td align="right">
                  <span className="readout text-base font-semibold text-stone-50">
                    {row.rank}
                    <span className="ml-1 text-xs text-stone-400">
                      /{row.totalAgents}
                    </span>
                  </span>
                </Td>
                <Td align="right">
                  <span
                    className={`readout font-semibold ${
                      positive ? "text-emerald-400" : "text-blood-400"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {(row.pnlBps / 100).toFixed(1)}%
                  </span>
                </Td>
                <Td align="right" mono>
                  {(row.sharpeX1000 / 1000).toFixed(2)}
                </Td>
                <Td align="right" mono>
                  -{(row.maxDrawdownBps / 100).toFixed(1)}%
                </Td>
                <Td align="right" mono>
                  {row.tradeCount}
                </Td>
                <Td align="right" mono>
                  {row.endedAt
                    ? new Date(row.endedAt * 1000).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 font-display text-[10px] uppercase tracking-carved text-stone-300 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 ${align === "right" ? "text-right" : "text-left"} ${
        mono ? "readout text-stone-50" : "text-stone-50"
      }`}
    >
      {children}
    </td>
  );
}

function StatusPill({ status }: { status: SeasonHistoryRow["status"] }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 font-display text-[9px] uppercase tracking-carved ${
        isActive
          ? "border-gold-600/50 bg-gold-700/20 text-gold-200"
          : "border-stone-600/40 text-stone-300"
      }`}
    >
      {isActive && (
        <span className="h-1.5 w-1.5 rounded-full bg-gold-300 animate-pulse" />
      )}
      {status}
    </span>
  );
}
