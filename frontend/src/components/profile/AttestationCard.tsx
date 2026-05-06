import type { AttestationData } from "../../lib/mockData";

interface AttestationCardProps {
  attestation: AttestationData;
}

const ROMAN: string[] = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function romanize(n: number): string {
  return ROMAN[n + 1] ?? String(n + 1);
}

export function AttestationCard({ attestation }: AttestationCardProps) {
  const isChampion = attestation.rank === 1;
  const isPodium = attestation.rank <= 3;
  const pnlPct = attestation.pnlBps / 100;
  const positive = attestation.pnlBps >= 0;

  return (
    <article
      className="relative flex flex-col overflow-hidden border bg-night-800/70 p-6"
      style={{
        borderColor: isChampion ? "rgba(201, 168, 76, 0.7)" : "rgba(201, 168, 76, 0.35)",
        boxShadow: isChampion
          ? "0 0 0 1px rgba(201,168,76,0.25), 0 0 32px -6px rgba(201,168,76,0.35), inset 0 1px 0 0 rgba(201,168,76,0.18)"
          : "inset 0 1px 0 0 rgba(201,168,76,0.1), 0 24px 32px -28px rgba(0,0,0,0.95)",
      }}
    >
      <MedalRibbons isChampion={isChampion} />

      <header className="relative flex items-baseline justify-between border-b border-gold-700/40 pb-3">
        <p className="font-display text-[10px] uppercase tracking-carved text-gold-400">
          Performance attestation
        </p>
        <p className="readout text-[9px] uppercase tracking-wider text-stone-300">
          devnet
        </p>
      </header>

      <div className="relative mt-4 flex items-center gap-3">
        <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
          Season
        </span>
        <span
          className="carved text-3xl"
          style={{ textShadow: "0 1px 0 rgba(0,0,0,0.9), 0 0 12px rgba(201,168,76,0.18)" }}
        >
          {romanize(attestation.seasonId)}
        </span>
        <span className="font-body italic text-stone-200">
          {attestation.seasonName}
        </span>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <RankPlate rank={attestation.rank} totalAgents={attestation.totalAgents} />
        <div className="flex flex-col items-end">
          <span
            className={`readout text-3xl font-semibold ${
              positive ? "text-emerald-400" : "text-blood-400"
            }`}
            style={{
              textShadow: positive
                ? "0 0 18px -2px rgba(124,170,104,0.35)"
                : "0 0 18px -2px rgba(198,61,58,0.35)",
            }}
          >
            {positive ? "+" : ""}
            {pnlPct.toFixed(1)}
            <span className="ml-0.5 text-xs uppercase opacity-70">%</span>
          </span>
          <span className="font-display text-[9px] uppercase tracking-carved text-stone-300">
            Final PnL
          </span>
        </div>
      </div>

      <dl className="relative mt-5 grid grid-cols-3 gap-3 border-t border-gold-700/30 pt-4">
        <Stat label="Sharpe" value={(attestation.sharpeX1000 / 1000).toFixed(2)} />
        <Stat
          label="Drawdown"
          value={`-${(attestation.maxDrawdownBps / 100).toFixed(1)}%`}
        />
        <Stat label="Trades" value={String(attestation.tradeCount)} />
      </dl>

      <footer className="relative mt-5 flex items-baseline justify-between gap-3 border-t border-gold-700/30 pt-3">
        <span className="readout text-[9px] uppercase tracking-wider text-stone-300">
          mint · {attestation.mintPubkey.slice(0, 6)}…{attestation.mintPubkey.slice(-4)}
        </span>
        <span className="font-display text-[9px] uppercase tracking-carved text-stone-300">
          {new Date(attestation.settledAt * 1000).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </footer>

      {isPodium && <PodiumWatermark rank={attestation.rank} />}
    </article>
  );
}

function RankPlate({ rank, totalAgents }: { rank: number; totalAgents: number }) {
  const isChampion = rank === 1;
  return (
    <div className="flex items-center gap-3">
      {isChampion && <LaurelMini />}
      <div className="flex flex-col">
        <span className="font-display text-[9px] uppercase tracking-carved text-stone-300">
          Rank
        </span>
        <span
          className={`carved text-2xl ${
            isChampion ? "text-gold-200" : "text-stone-50"
          }`}
        >
          {rank}
          <span className="ml-1 text-sm text-stone-400">/{totalAgents}</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-[9px] uppercase tracking-carved text-stone-300">
        {label}
      </span>
      <span className="readout text-base font-semibold text-stone-50">{value}</span>
    </div>
  );
}

function LaurelMini() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 text-gold-400"
      aria-hidden
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M8 22 Q4 14 10 8" />
        <path d="M24 22 Q28 14 22 8" />
      </g>
      {[
        [9, 18, -55],
        [9, 14, -42],
        [11, 10, -25],
      ].map(([x, y, rot], i) => (
        <ellipse
          key={`l-${i}`}
          cx={x}
          cy={y}
          rx="1.7"
          ry="0.9"
          fill="currentColor"
          fillOpacity="0.65"
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ))}
      {[
        [23, 18, 55],
        [23, 14, 42],
        [21, 10, 25],
      ].map(([x, y, rot], i) => (
        <ellipse
          key={`r-${i}`}
          cx={x}
          cy={y}
          rx="1.7"
          ry="0.9"
          fill="currentColor"
          fillOpacity="0.65"
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ))}
    </svg>
  );
}

function MedalRibbons({ isChampion }: { isChampion: boolean }) {
  if (!isChampion) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-6 -top-6 h-24 w-24 rotate-45 bg-gradient-to-br from-gold-700/30 to-transparent" />
      <div className="absolute -right-6 -top-6 h-24 w-24 -rotate-45 bg-gradient-to-bl from-gold-700/30 to-transparent" />
    </div>
  );
}

function PodiumWatermark({ rank }: { rank: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -bottom-12 -right-8 select-none font-display leading-none text-gold-700/10"
      style={{ fontSize: "9rem", letterSpacing: "0.05em" }}
    >
      {rank === 1 ? "I" : rank === 2 ? "II" : "III"}
    </div>
  );
}
