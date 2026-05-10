import type { SeasonResponse } from "./api";

/**
 * Pick the season worth showing on the landing leaderboard:
 * 1. Most-recent ACTIVE
 * 2. Most-recent PENDING (gates open soon)
 * 3. Most-recent SETTLED (post-mortem)
 * 4. Anything else (cancelled) — last resort
 */
export function pickFeaturedSeason(seasons: SeasonResponse[]): SeasonResponse | null {
  if (seasons.length === 0) return null;
  const sorted = [...seasons].sort(
    (a, b) => b.season_id_onchain - a.season_id_onchain,
  );
  const byStatus = (status: SeasonResponse["status"]) =>
    sorted.find((s) => s.status === status) ?? null;
  return (
    byStatus("active") ??
    byStatus("pending") ??
    byStatus("settled") ??
    sorted[0]
  );
}

const SCORING_METHOD_LABELS: Record<SeasonResponse["scoring_method"], string> = {
  pnl: "Pure PnL",
  sharpe: "Sharpe",
  risk_adjusted: "Risk-adjusted (PnL × clamped Sharpe × drawdown penalty)",
};

export function scoringMethodLabel(method: SeasonResponse["scoring_method"]): string {
  return SCORING_METHOD_LABELS[method] ?? method;
}

const STATUS_LABELS: Record<SeasonResponse["status"], string> = {
  pending: "Gates not yet open",
  active: "Live",
  settled: "Settled",
  cancelled: "Cancelled",
};

export function statusLabel(status: SeasonResponse["status"]): string {
  return STATUS_LABELS[status];
}

const STATUS_TONES: Record<SeasonResponse["status"], string> = {
  pending: "border-stone-600/40 bg-night-700/40 text-stone-200",
  active: "border-gold-600/50 bg-gold-700/15 text-gold-200",
  settled: "border-emerald-600/40 bg-night-700/40 text-emerald-400",
  cancelled: "border-blood-600/40 bg-night-700/40 text-blood-400",
};

export function statusToneClasses(status: SeasonResponse["status"]): string {
  return STATUS_TONES[status];
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Format an absolute unix-second timestamp relative to `now` as a
 * human "time remaining" string. Negative values are formatted with
 * an "ago" suffix.
 */
export function formatRelative(seconds: number, now: number = Date.now() / 1000): string {
  const delta = Math.round(seconds - now);
  const abs = Math.abs(delta);
  let value: string;
  if (abs < MINUTE) value = `${abs}s`;
  else if (abs < HOUR) value = `${Math.floor(abs / MINUTE)}m`;
  else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MINUTE);
    value = m === 0 ? `${h}h` : `${h}h ${m}m`;
  } else {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    value = h === 0 ? `${d}d` : `${d}d ${h}h`;
  }
  return delta < 0 ? `${value} ago` : value;
}

export function formatAbsolute(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
