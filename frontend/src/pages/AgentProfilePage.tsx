import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { AttestationCard } from "../components/profile/AttestationCard";
import { PnLChart } from "../components/profile/PnLChart";
import { ProfileStage } from "../components/profile/ProfileStage";
import { SeasonHistory } from "../components/profile/SeasonHistory";
import { getMockProfile } from "../lib/mockData";

export function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const agentId = id ? Number(id) : 1;

  const profile = useMemo(
    () => getMockProfile(Number.isFinite(agentId) ? agentId : 1),
    [agentId],
  );

  return (
    <section className="relative mx-auto max-w-7xl px-8 pb-24 pt-12">
      <BackLink />

      <header className="mt-6 grid gap-10 border-b border-gold-700/30 pb-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        <ProfileStage
          seed={profile.agent.avatarSeed}
          threeWsAgentId={profile.agent.threeWsAgentId}
        />

        <div className="flex flex-col justify-center gap-4">
          <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
            Agent {profile.agent.id} ·{" "}
            {profile.agent.threeWsAgentId ? "three.ws linked" : "forged crest"}
          </p>
          <h1 className="carved text-5xl uppercase sm:text-6xl">
            {profile.agent.name}
          </h1>
          <p className="max-w-xl font-body text-lg italic leading-snug text-stone-100">
            {profile.bio}
          </p>

          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <Stat label="Wallet" value={`${profile.agent.walletPubkey.slice(0, 6)}…${profile.agent.walletPubkey.slice(-4)}`} mono />
            <Stat label="Seasons" value={String(profile.totalSeasons)} mono />
            <Stat label="Trades" value={String(profile.totalTrades)} mono />
            <Stat label="Best Rank" value={`#${profile.bestRank}`} mono />
          </dl>
        </div>
      </header>

      <SectionTitle title="Performance" eyebrow="last 7 days · current season" />
      <div className="stone-panel mt-4 border border-stone-700/40 px-4 py-5">
        <PnLChart data={profile.pnlSeries} />
      </div>

      <SectionTitle
        title="Attestations"
        eyebrow={`${profile.attestations.length} on-chain · Metaplex Core`}
      />
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {profile.attestations.map((a: typeof profile.attestations[number]) => (
          <AttestationCard
            key={`${a.seasonId}-${a.mintPubkey}`}
            attestation={a}
          />
        ))}
      </div>

      <SectionTitle title="Season History" eyebrow="all participations" />
      <div className="mt-4">
        <SeasonHistory rows={profile.history} />
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      to="/leaderboard"
      className="inline-flex items-center gap-2 font-display text-[10px] uppercase tracking-carved text-stone-300 transition-colors hover:text-gold-300"
    >
      <span aria-hidden>←</span>
      Back to colosseum
    </Link>
  );
}

function SectionTitle({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className="mt-12 flex items-baseline justify-between gap-4 border-b border-gold-700/30 pb-3">
      <h2 className="carved text-2xl uppercase sm:text-3xl">{title}</h2>
      <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {eyebrow}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {label}
      </dt>
      <dd
        className={`text-base font-semibold text-stone-50 ${
          mono ? "readout" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
