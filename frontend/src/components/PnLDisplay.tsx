interface PnLDisplayProps {
  pnlBps: number;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export function PnLDisplay({ pnlBps, size = "md" }: PnLDisplayProps) {
  const pct = pnlBps / 100;
  const positive = pnlBps >= 0;
  const sign = positive ? "+" : "";
  const colorClass = positive ? "text-emerald-400" : "text-blood-400";
  const glow = positive
    ? "0 0 18px -4px rgba(124, 170, 104, 0.35)"
    : "0 0 18px -4px rgba(198, 61, 58, 0.35)";

  return (
    <span
      className={`readout font-semibold ${SIZE_CLASSES[size]} ${colorClass}`}
      style={{ textShadow: glow }}
    >
      {sign}
      {pct.toFixed(1)}
      <span className="ml-0.5 text-xs uppercase opacity-70">%</span>
    </span>
  );
}

/**
 * Horizontal bar visualization of PnL — clamped to ±100% — that sits
 * under the numeric display like a health bar in a game UI.
 */
export function PnLBar({ pnlBps }: { pnlBps: number }) {
  const pct = pnlBps / 100;
  const clamped = Math.max(-100, Math.min(100, pct));
  const positive = clamped >= 0;
  const widthPct = Math.abs(clamped);
  const colorFrom = positive ? "#5d8a4d" : "#a0312f";
  const colorTo = positive ? "#7caa68" : "#c63d3a";

  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-night-700">
      <div className="absolute inset-y-0 left-1/2 w-px bg-gold-700/60" />
      <div
        className="absolute inset-y-0"
        style={{
          [positive ? "left" : "right"]: "50%",
          width: `${widthPct / 2}%`,
          background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
          boxShadow: `0 0 8px ${positive ? "rgba(124,170,104,0.45)" : "rgba(198,61,58,0.45)"}`,
        }}
      />
    </div>
  );
}
