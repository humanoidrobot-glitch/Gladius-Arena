import { useEffect, useState } from "react";

import type { SeasonResponse } from "../lib/api";
import {
  formatAbsolute,
  formatRelative,
  scoringMethodLabel,
  statusLabel,
  statusToneClasses,
} from "../lib/seasons";
import { tokenSymbol } from "../lib/tokens";

interface SeasonTermsProps {
  season: SeasonResponse;
}

/**
 * Public season-rules panel — name, description, status, trading
 * universe, scoring method, schedule, attestation note. Sits above the
 * leaderboard so anyone landing on /seasons knows the rules of the
 * arena before they read the rankings.
 */
export function SeasonTerms({ season }: SeasonTermsProps) {
  // Re-render every 30s so the relative "ends in" / "started" times tick.
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const trimmedDescription = season.description?.trim() ?? "";
  const universeIsOpen = season.trading_universe.length === 0;

  return (
    <section className="stone-panel rounded-sm border border-gold-700/30 px-7 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
            Season {season.season_id_onchain} · the rules
          </p>
          <h2 className="carved mt-2 text-3xl uppercase sm:text-4xl">
            {season.name}
          </h2>
          {trimmedDescription && (
            <p className="mt-3 max-w-2xl font-body text-base italic text-stone-200">
              {trimmedDescription}
            </p>
          )}
        </div>
        <StatusPill status={season.status} />
      </div>

      <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Term label="Scoring">
          <span className="font-body text-base text-stone-50">
            {scoringMethodLabel(season.scoring_method)}
          </span>
        </Term>
        <Term label="Participants">
          <span className="readout text-base text-stone-50">
            {season.agent_count}
            <span className="text-stone-300"> / {season.max_agents}</span>
          </span>
        </Term>
        <Term label={season.status === "active" ? "Closes" : "Ends"}>
          <div className="flex flex-col">
            <span className="readout text-base text-stone-50">
              {formatAbsolute(season.end_time)}
            </span>
            <span className="font-body text-xs italic text-stone-300">
              {now < season.end_time
                ? `${formatRelative(season.end_time, now)} from now`
                : `${formatRelative(season.end_time, now)}`}
            </span>
          </div>
        </Term>
        {season.start_time != null && (
          <Term label="Opened">
            <div className="flex flex-col">
              <span className="readout text-base text-stone-50">
                {formatAbsolute(season.start_time)}
              </span>
              <span className="font-body text-xs italic text-stone-300">
                {formatRelative(season.start_time, now)}
              </span>
            </div>
          </Term>
        )}
        <Term label="Trading universe">
          {universeIsOpen ? (
            <span className="font-body text-base italic text-stone-100">
              Open — any pair is fair game
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {season.trading_universe.map((mint) => (
                <span
                  key={mint}
                  className="rounded-sm border border-gold-700/40 bg-night-700/60 px-2 py-0.5 font-display text-[11px] uppercase tracking-imperial text-gold-200"
                  title={mint}
                >
                  {tokenSymbol(mint)}
                </span>
              ))}
            </div>
          )}
        </Term>
      </dl>

      <div className="mt-6 border-t border-stone-700/40 pt-4 font-body text-sm text-stone-300">
        <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
          Attestations
        </span>{" "}
        <span className="italic">
          Top finishers receive a non-transferable Metaplex Core attestation
          NFT at settlement, recording rank · PnL · Sharpe · drawdown ·
          trade count. Phase I is deferred-on-chain — the credential mints
          to the program once mainnet deploys.
        </span>
      </div>
    </section>
  );
}

function Term({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: SeasonResponse["status"] }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1 font-display text-[10px] uppercase tracking-carved ${statusToneClasses(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}
