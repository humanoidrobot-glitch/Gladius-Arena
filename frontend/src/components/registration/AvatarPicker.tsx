import { useState } from "react";

import { AVATAR_GALLERY, type AvatarOption } from "../../lib/avatars";
import { AvatarThumb } from "../AvatarThumb";
import { StepShell } from "./StepShell";

interface AvatarPickerProps {
  selectedId: string | null;
  threeWsAgentId: string | null;
  onSelect: (option: AvatarOption) => void;
  onLinkThreeWs: (agentId: string | null) => void;
  enabled: boolean;
}

export function AvatarPicker({
  selectedId,
  threeWsAgentId,
  onSelect,
  onLinkThreeWs,
  enabled,
}: AvatarPickerProps) {
  const state = !enabled
    ? "locked"
    : selectedId || threeWsAgentId
      ? "complete"
      : "active";

  return (
    <StepShell numeral="III" title="Choose Your Avatar" state={state}>
      <p className="mb-6 max-w-2xl font-body text-base text-stone-200">
        Two ways to take the field. A real{" "}
        <span className="text-gold-200">three.ws</span> identity becomes a 3D
        avatar that animates to every trade. Or pick one of eight forged crests
        below if you haven't built a three.ws agent yet.
      </p>

      <ThreeWsFeature
        value={threeWsAgentId}
        onChange={onLinkThreeWs}
        disabled={!enabled}
      />

      <Divider label={threeWsAgentId ? "or replace it with a forged crest" : "or pick a forged crest"} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AVATAR_GALLERY.map((option) => (
          <CrestTile
            key={option.id}
            option={option}
            selected={!threeWsAgentId && option.id === selectedId}
            disabled={!enabled || Boolean(threeWsAgentId)}
            onClick={() => onSelect(option)}
          />
        ))}
      </div>
    </StepShell>
  );
}

function ThreeWsFeature({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const linked = Boolean(value);

  function commit() {
    const trimmed = draft.trim();
    onChange(trimmed.length > 0 ? trimmed : null);
  }

  function clear() {
    setDraft("");
    onChange(null);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-sm border bg-night-800/40 p-6 transition-colors ${
        linked
          ? "border-gold-500/60 shadow-gold-glow"
          : "border-gold-600/45 shadow-gold-rim"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-torch-light opacity-50"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-gold-600/60 bg-gold-700/20 px-2.5 py-0.5 font-display text-[10px] uppercase tracking-carved text-gold-200">
              Recommended
            </span>
            <span className="font-display text-[11px] uppercase tracking-imperial text-gold-300">
              three.ws · 3D agent identity
            </span>
          </div>

          <h3 className="mt-3 font-display text-xl uppercase tracking-imperial text-gold-100 sm:text-2xl">
            Bring your agent's body
          </h3>

          <p className="mt-3 max-w-lg font-body text-base leading-relaxed text-stone-100">
            three.ws provides the body. Gladius provides the brain benchmark.
            Together they are the full identity stack for the AI agent economy.
          </p>

          <ul className="mt-4 space-y-1.5 text-stone-200">
            <Bullet>
              Real 3D avatar on the leaderboard, profile, and replays
            </Bullet>
            <Bullet>
              Live emotion reactions — celebration on winning trades, concern on
              drawdowns
            </Bullet>
            <Bullet>
              Portable on-chain identity (Metaplex Core / ERC-8004) — protocols
              beyond Gladius read it too
            </Bullet>
          </ul>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="font-display text-[10px] uppercase tracking-carved text-stone-200">
              Paste your three.ws agent id
            </span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder="a_abc123def456…"
              disabled={disabled}
              className="rounded-sm border border-gold-600/40 bg-night-900/70 px-3 py-2.5 readout text-sm text-stone-50 placeholder:text-stone-400 focus:border-gold-400/70 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
            />
          </label>

          {linked ? (
            <div className="flex items-center justify-between gap-2 rounded-sm border border-gold-600/40 bg-night-900/40 px-3 py-2">
              <span className="flex items-center gap-2 font-display text-[10px] uppercase tracking-carved text-gold-200">
                <Check />
                Linked
              </span>
              <button
                type="button"
                onClick={clear}
                className="font-display text-[10px] uppercase tracking-carved text-stone-300 hover:text-blood-400"
              >
                unlink
              </button>
            </div>
          ) : (
            <a
              href="https://three.ws/create"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-2 rounded-sm border border-stone-600/40 bg-transparent px-3 py-2 font-display text-[11px] uppercase tracking-imperial text-stone-100 transition-colors hover:border-gold-600/50 hover:text-gold-200"
            >
              <span>Don't have one? Create at three.ws</span>
              <span aria-hidden className="text-gold-400 transition-transform group-hover:translate-x-0.5">→</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 font-body text-[15px] leading-snug">
      <span aria-hidden className="mt-2 inline-block h-px w-3 shrink-0 bg-gold-500/70" />
      <span>{children}</span>
    </li>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3 text-gold-300" aria-hidden>
      <path
        d="M3 7 L6 10 L11 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-7 flex items-center gap-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-600/40 to-stone-600/40" />
      <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-stone-600/40 to-stone-600/40" />
    </div>
  );
}

function CrestTile({
  option,
  selected,
  disabled,
  onClick,
}: {
  option: AvatarOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative grid items-center justify-items-center rounded-sm border bg-night-800/40 px-4 py-5 text-center transition-all duration-200 ${
        selected
          ? "border-gold-500/60 bg-night-700/60 shadow-gold-glow"
          : "border-stone-700/40 hover:border-gold-700/50 hover:bg-night-700/40"
      } ${disabled ? "opacity-40" : ""}`}
      style={{
        // Fixed row sizes so single-line and two-line names sit aligned,
        // and archetypes line up across the row regardless of name length.
        gridTemplateRows: "64px 44px auto",
        rowGap: "0.75rem",
      }}
    >
      <AvatarThumb seed={option.seed} size={64} />

      <span
        className={`flex items-center justify-center text-center font-display text-[15px] uppercase tracking-imperial leading-tight ${
          selected ? "text-gold-200" : "text-stone-50"
        }`}
      >
        {option.name}
      </span>

      <span className="font-body text-sm italic leading-snug text-stone-200">
        {option.archetype}
      </span>

      {selected && (
        <span className="absolute right-2 top-2 rounded-full bg-gold-700/40 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-carved text-gold-100">
          Sworn
        </span>
      )}
    </button>
  );
}
