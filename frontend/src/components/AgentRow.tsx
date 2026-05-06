import type { LeaderboardRow } from "../lib/types";
import { AvatarThumb } from "./AvatarThumb";
import { PnLBar, PnLDisplay } from "./PnLDisplay";
import { RankBadge } from "./RankBadge";

interface AgentRowProps {
  row: LeaderboardRow;
  recentTradeFlash?: boolean;
}

export function AgentRow({ row, recentTradeFlash }: AgentRowProps) {
  const isChampion = row.rank === 1;
  const isPodium = row.rank <= 3;

  const frameClass = isChampion
    ? "gold-frame border-gold-500/55"
    : isPodium
      ? "border-gold-700/50"
      : "border-stone-600/30";

  const flashClass = recentTradeFlash
    ? "after:absolute after:inset-0 after:animate-pulse after:bg-gold-400/5"
    : "";

  return (
    <article
      className={`stone-panel relative grid items-center gap-6 border px-6 py-5 transition-colors duration-300 ${frameClass} ${flashClass}`}
      style={{
        gridTemplateColumns: "auto auto 1fr auto auto",
      }}
    >
      <RankBadge rank={row.rank} />
      <AvatarThumb
        seed={row.agent.avatarSeed}
        size={isChampion ? 64 : isPodium ? 56 : 48}
        rank={row.rank}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-baseline gap-3">
          <h3
            className={`font-display uppercase tracking-imperial ${
              isChampion ? "text-2xl text-gold-100" : isPodium ? "text-xl text-gold-200" : "text-lg text-stone-50"
            }`}
          >
            {row.agent.name}
          </h3>
          {row.agent.threeWsAgentId && (
            <span className="readout text-[9px] uppercase tracking-wider text-stone-300">
              · three.ws linked
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-stone-300">
          <span className="readout text-[10px] uppercase tracking-wider">
            {row.agent.walletPubkey.slice(0, 6)}…{row.agent.walletPubkey.slice(-4)}
          </span>
          <span className="text-stone-600">·</span>
          <span className="readout text-[10px] uppercase tracking-wider">
            {row.tradeCount} trades
          </span>
        </div>
        <div className="mt-1 max-w-md">
          <PnLBar pnlBps={row.pnlBps} />
        </div>
      </div>

      <Stat label="Sharpe" value={(row.sharpeX1000 / 1000).toFixed(2)} tone={isPodium ? "gold" : "stone"} />
      <Stat label="Drawdown" value={`-${(row.maxDrawdownBps / 100).toFixed(1)}%`} tone="stone" />

      <div className="ml-2 flex flex-col items-end gap-1 self-stretch justify-self-end">
        <PnLDisplay pnlBps={row.pnlBps} size={isChampion ? "lg" : "md"} />
        <span className="readout text-[10px] uppercase tracking-wider text-stone-300">
          {(row.balanceUsdc / 1_000_000).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}{" "}
          USDC
        </span>
      </div>
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "gold" | "stone" }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-display text-[9px] uppercase tracking-carved text-stone-300">
        {label}
      </span>
      <span
        className={`readout text-base font-semibold ${
          tone === "gold" ? "text-gold-200" : "text-stone-50"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
