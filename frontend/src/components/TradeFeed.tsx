import { tokenSymbol } from "../lib/mockData";
import type { GladiusEvent, SwapEventData } from "../lib/types";

interface TradeFeedProps {
  events: GladiusEvent[];
  agentNamesById: Map<number, string>;
}

function isSwap(event: GladiusEvent): event is GladiusEvent & { data: SwapEventData } {
  return event.type === "swap_detected";
}

function formatTimestamp(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRawAmount(raw: string, decimals = 6): string {
  const big = BigInt(raw);
  const divisor = BigInt(10 ** decimals);
  const whole = Number(big / divisor);
  const remainder = Number(big % divisor) / 10 ** decimals;
  return (whole + remainder).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function TradeFeed({ events, agentNamesById }: TradeFeedProps) {
  const swaps = events.filter(isSwap).slice(0, 12);

  return (
    <aside className="stone-panel flex h-full flex-col border border-gold-700/30">
      <header className="flex items-center justify-between border-b border-gold-700/30 px-5 py-4">
        <h2 className="font-display text-[11px] uppercase tracking-carved text-gold-300">
          Trade Feed
        </h2>
        <span className="flex items-center gap-2">
          <LiveDot />
          <span className="readout text-[9px] uppercase tracking-wider text-stone-300">
            Live
          </span>
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {swaps.length === 0 ? (
          <p className="px-5 py-10 text-center font-body italic text-stone-300">
            The colosseum is silent. Awaiting the first strike.
          </p>
        ) : (
          <ul className="divide-y divide-stone-700/40">
            {swaps.map((event, i) => {
              const data = event.data;
              const agentName = event.agentId
                ? agentNamesById.get(event.agentId) ?? "Unknown"
                : "Unknown";
              const isLatest = i === 0;
              return (
                <li
                  key={`${event.timestamp}-${event.agentId}-${i}`}
                  className="px-5 py-3 transition-colors duration-500"
                  style={{
                    background: isLatest
                      ? "linear-gradient(90deg, rgba(201,168,76,0.08), transparent)"
                      : undefined,
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-sm uppercase tracking-imperial text-gold-200">
                      {agentName}
                    </span>
                    <span className="readout text-[10px] tracking-wider text-stone-300">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-sm text-stone-100">
                    swapped{" "}
                    <span className="readout text-stone-50">
                      {formatRawAmount(data.amountInRaw, 9)}
                    </span>{" "}
                    <span className="readout text-stone-300">
                      {tokenSymbol(data.tokenIn)}
                    </span>{" "}
                    <span className="text-gold-600">→</span>{" "}
                    <span className="readout text-stone-50">
                      {formatRawAmount(data.amountOutRaw, 6)}
                    </span>{" "}
                    <span className="readout text-stone-300">
                      {tokenSymbol(data.tokenOut)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-65" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-300" />
    </span>
  );
}
