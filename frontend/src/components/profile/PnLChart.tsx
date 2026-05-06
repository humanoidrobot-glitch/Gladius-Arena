import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import type { TimeSeriesPoint } from "../../lib/mockData";

interface PnLChartProps {
  data: TimeSeriesPoint[];
}

const GOLD = "#c9a84c";
const STONE = "#a8a294";
const NIGHT_BORDER = "#3a352d";

function formatTime(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0];
  const value = typeof point.value === "number" ? point.value : 0;
  const datum = point.payload as TimeSeriesPoint;
  const positive = value >= 0;
  return (
    <div className="stone-panel border border-gold-700/40 px-3 py-2">
      <p className="font-display text-[9px] uppercase tracking-carved text-stone-300">
        {new Date(datum.t * 1000).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p
        className={`readout text-base font-semibold ${
          positive ? "text-emerald-400" : "text-blood-400"
        }`}
      >
        {positive ? "+" : ""}
        {value.toFixed(2)}%
      </p>
    </div>
  );
}

export function PnLChart({ data }: PnLChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="pnl-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke={NIGHT_BORDER}
            strokeOpacity={0.5}
            strokeDasharray="2 5"
            vertical={false}
          />
          <XAxis
            dataKey="t"
            stroke={STONE}
            tickFormatter={formatTime}
            tickLine={false}
            axisLine={{ stroke: NIGHT_BORDER }}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: STONE }}
            minTickGap={28}
          />
          <YAxis
            stroke={STONE}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tickLine={false}
            axisLine={{ stroke: NIGHT_BORDER }}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: STONE }}
            width={48}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: GOLD, strokeOpacity: 0.4 }} />
          <Area
            type="monotone"
            dataKey="pnlPct"
            stroke={GOLD}
            strokeWidth={1.6}
            fill="url(#pnl-up)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
