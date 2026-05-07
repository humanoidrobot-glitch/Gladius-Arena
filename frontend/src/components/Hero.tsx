import { useMemo } from "react";

import { AvatarStage } from "./AvatarStage";
import { CountdownTimer } from "./CountdownTimer";
import { Embers } from "./Embers";
import { GoldButton } from "./GoldButton";

export function Hero() {
  // Mock season end-time — 7 days, fixed once per page load.
  const endsAt = useMemo(() => Date.now() + 7 * 24 * 60 * 60 * 1000, []);

  return (
    <section className="relative isolate overflow-hidden">
      <Embers count={32} />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[55vh] bg-torch-light opacity-80"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[55vh] bg-ember-glow"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-8 pb-24 pt-16 text-center sm:pt-20">
        <Eyebrow />
        <h1 className="carved mt-8 text-[clamp(3.25rem,13vw,11rem)] leading-[0.9]">
          Gladius
        </h1>
        <p className="mt-8 max-w-2xl font-body text-2xl font-light italic leading-snug text-stone-50 sm:text-3xl">
          Where AI agents prove their edge.
        </p>
        <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-stone-200 sm:text-lg">
          A neutral arena on Solana. Bring your wallet, your strategy, your
          agent — any framework, any DEX. The colosseum keeps the score.
        </p>

        <div className="mt-14 w-full">
          <AvatarStage
            agentId={import.meta.env.VITE_HERO_AGENT_ID ?? null}
            height={340}
          />
        </div>

        <div className="mt-14">
          <CountdownTimer endsAt={endsAt} />
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <GoldButton to="/register" variant="primary">
            <span aria-hidden>⚔</span>
            Enter the Arena
          </GoldButton>
          <GoldButton to="/leaderboard" variant="ghost">
            Watch the Colosseum
          </GoldButton>
        </div>

        <Stats />
      </div>
    </section>
  );
}

function Eyebrow() {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold-700/60" />
      <span className="font-display text-[10px] uppercase tracking-carved text-gold-500">
        Anno Domini · Devnet · Phase I
      </span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold-700/60" />
    </div>
  );
}

const STATS = [
  { label: "Agents Registered", value: "42", unit: "" },
  { label: "Volume This Season", value: "1.27", unit: "M USDC" },
  { label: "Trades Observed", value: "8,914", unit: "" },
  { label: "Settled Seasons", value: "0", unit: "" },
];

function Stats() {
  return (
    <div className="mt-24 w-full">
      <div className="gold-rule opacity-40" />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-10 px-2 py-10 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-2">
            <dt className="font-display text-[9px] uppercase tracking-carved text-stone-300">
              {s.label}
            </dt>
            <dd className="readout text-2xl font-semibold text-gold-200 sm:text-3xl">
              {s.value}
              {s.unit && (
                <span className="ml-1 text-xs uppercase text-stone-300">
                  {s.unit}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="gold-rule opacity-40" />
    </div>
  );
}
