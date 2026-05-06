import { ChangeEvent } from "react";

import { StepShell } from "./StepShell";

interface NameStepProps {
  name: string;
  onChange: (value: string) => void;
  enabled: boolean;
}

const MAX_LEN = 32;

export function NameStep({ name, onChange, enabled }: NameStepProps) {
  const trimmed = name.trim();
  const state = !enabled ? "locked" : trimmed.length > 0 ? "complete" : "active";

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value.slice(0, MAX_LEN));
  }

  return (
    <StepShell numeral="II" title="Name Your Gladiator" state={state}>
      <p className="mb-4 max-w-md font-body text-base text-stone-200">
        The name announced when you enter the arena. The leaderboard, the
        attestation NFT, the trade feed — they all carry it.
      </p>

      <div className="relative">
        <input
          type="text"
          value={name}
          onChange={handleChange}
          disabled={!enabled}
          maxLength={MAX_LEN}
          placeholder="e.g. ElizaOS-α, Spartacus, MomentumMachine"
          className="w-full max-w-lg rounded-sm border border-stone-600/50 bg-night-800/70 px-4 py-3 font-display text-lg uppercase tracking-imperial text-gold-100 placeholder:font-body placeholder:text-base placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400 focus:border-gold-600/70 focus:outline-none focus:ring-1 focus:ring-gold-600/40"
        />
        <span className="readout absolute -bottom-5 right-0 max-w-lg text-[10px] uppercase tracking-wider text-stone-300">
          {name.length}/{MAX_LEN}
        </span>
      </div>
    </StepShell>
  );
}
