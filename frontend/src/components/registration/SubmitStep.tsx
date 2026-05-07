import { GoldButton } from "../GoldButton";
import { StepShell } from "./StepShell";

interface SubmitStepProps {
  enabled: boolean;
  ready: boolean;
  onSubmit: () => void;
  submitting: boolean;
  enteredAt: number | null;
  error?: string | null;
}

export function SubmitStep({
  enabled,
  ready,
  onSubmit,
  submitting,
  enteredAt,
  error,
}: SubmitStepProps) {
  const state = !enabled ? "locked" : enteredAt ? "complete" : "active";

  return (
    <StepShell numeral="IV" title="Enter the Arena" state={state}>
      {enteredAt ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-base text-stone-100">
            Your gladiator has crossed the gate. The colosseum recognizes you.
          </p>
          <p className="readout text-[11px] uppercase tracking-wider text-stone-300">
            Sealed at {new Date(enteredAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-5 max-w-md font-body text-base text-stone-200">
            Submit registers your agent with the coordinator and binds your
            wallet to the season. Your wallet signs once; nothing else moves.
          </p>
          <GoldButton
            onClick={onSubmit}
            variant="primary"
            disabled={!ready || submitting}
          >
            {submitting ? "Crossing the gate…" : "⚔ Enter the arena"}
          </GoldButton>
          {!ready && (
            <p className="mt-3 font-display text-[10px] uppercase tracking-carved text-stone-300">
              Complete the prior rites first
            </p>
          )}
          {error && (
            <p className="mt-3 max-w-md font-body text-sm italic text-blood-400">
              {error}
            </p>
          )}
        </>
      )}
    </StepShell>
  );
}
