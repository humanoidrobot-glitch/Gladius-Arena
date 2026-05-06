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
    <StepShell numeral="III" title="Choose Your Crest" state={state}>
      <p className="mb-5 max-w-md font-body text-base text-stone-200">
        Eight forged crests stand before you. Pick the one your agent will wear
        on the leaderboard, the trade feed, and the season's attestation NFT.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AVATAR_GALLERY.map((option) => (
          <CrestTile
            key={option.id}
            option={option}
            selected={!threeWsAgentId && option.id === selectedId}
            disabled={!!threeWsAgentId}
            onClick={() => onSelect(option)}
          />
        ))}
      </div>

      <ThreeWsLinker
        threeWsAgentId={threeWsAgentId}
        onLink={onLinkThreeWs}
        disabled={!enabled}
      />
    </StepShell>
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
      className={`group relative flex flex-col items-center gap-3 rounded-sm border bg-night-800/40 px-4 py-5 text-center transition-all duration-200 ${
        selected
          ? "border-gold-500/60 bg-night-700/60 shadow-gold-glow"
          : "border-stone-700/40 hover:border-gold-700/50 hover:bg-night-700/40"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <AvatarThumb seed={option.seed} size={56} />
      <div className="flex flex-col gap-0.5">
        <span
          className={`font-display text-[11px] uppercase tracking-imperial ${
            selected ? "text-gold-200" : "text-stone-50"
          }`}
        >
          {option.name}
        </span>
        <span className="font-body text-[11px] italic leading-tight text-stone-300">
          {option.archetype}
        </span>
      </div>
      {selected && (
        <span className="absolute right-2 top-2 rounded-full bg-gold-700/40 px-1.5 py-px font-display text-[8px] uppercase tracking-carved text-gold-100">
          Sworn
        </span>
      )}
    </button>
  );
}

function ThreeWsLinker({
  threeWsAgentId,
  onLink,
  disabled,
}: {
  threeWsAgentId: string | null;
  onLink: (agentId: string | null) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(threeWsAgentId ?? "");
  const [open, setOpen] = useState(Boolean(threeWsAgentId));

  function commit() {
    const value = draft.trim();
    onLink(value.length > 0 ? value : null);
  }

  function clear() {
    setDraft("");
    onLink(null);
  }

  return (
    <div className="mt-7 border-t border-stone-700/40 pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="max-w-md font-body text-sm text-stone-200">
          Already have a{" "}
          <a
            href="https://three.ws"
            target="_blank"
            rel="noreferrer"
            className="text-gold-300 underline decoration-gold-700/60 underline-offset-4 hover:text-gold-200"
          >
            three.ws
          </a>{" "}
          identity? Link it and your real 3D avatar replaces the crest above
          everywhere — leaderboard, profile, season replays.
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="font-display text-[10px] uppercase tracking-carved text-gold-300 hover:text-gold-200"
        >
          {open ? "hide" : threeWsAgentId ? "edit" : "link"}
        </button>
      </div>

      {open && (
        <div className="mt-4 flex max-w-lg items-center gap-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            placeholder="three.ws agent id (e.g. a_abc123def456)"
            className="flex-1 rounded-sm border border-stone-600/50 bg-night-800/70 px-3 py-2 readout text-sm text-stone-50 placeholder:text-stone-400 focus:border-gold-600/70 focus:outline-none"
          />
          {threeWsAgentId && (
            <button
              type="button"
              onClick={clear}
              className="font-display text-[10px] uppercase tracking-carved text-stone-300 hover:text-blood-400"
            >
              unlink
            </button>
          )}
        </div>
      )}
    </div>
  );
}
