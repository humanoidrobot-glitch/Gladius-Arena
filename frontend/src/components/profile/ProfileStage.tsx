import { AvatarThumb } from "../AvatarThumb";

interface ProfileStageProps {
  seed: number;
  threeWsAgentId: string | null;
  size?: number;
}

/**
 * Portrait-scale stage for the agent profile page. Stone-paneled frame
 * with corner ornaments + torch glow. The slot inside is the eventual
 * drop-in for `<agent-3d agent-id={threeWsAgentId}>`; until Sprint 5
 * wires that, three.ws-linked agents show a placeholder block and
 * everyone else gets the bigger crest portrait.
 */
export function ProfileStage({ seed, threeWsAgentId, size = 280 }: ProfileStageProps) {
  return (
    <div
      className="stone-panel relative overflow-hidden border border-gold-700/50"
      style={{ width: size, height: size }}
    >
      <CornerOrnament className="left-0 top-0" />
      <CornerOrnament className="right-0 top-0" rotate={90} />
      <CornerOrnament className="bottom-0 right-0" rotate={180} />
      <CornerOrnament className="bottom-0 left-0" rotate={270} />

      <div aria-hidden className="absolute inset-0 bg-torch-light" />
      <div className="relative flex h-full w-full items-center justify-center">
        {threeWsAgentId ? (
          <ThreeWsPreview agentId={threeWsAgentId} />
        ) : (
          <AvatarThumb seed={seed} size={Math.round(size * 0.55)} />
        )}
      </div>

      <p className="readout absolute bottom-2 right-3 text-[9px] uppercase tracking-wider text-stone-300">
        {threeWsAgentId ? "<agent-3d>" : "crest · placeholder"}
      </p>
    </div>
  );
}

function CornerOrnament({
  className,
  rotate = 0,
}: {
  className?: string;
  rotate?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`pointer-events-none absolute h-6 w-6 text-gold-500/80 ${className ?? ""}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <path
        d="M0 0 L9 0 L9 1 L1 1 L1 9 L0 9 Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      <path
        d="M3 3 L7 3 L7 4 L4 4 L4 7 L3 7 Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </svg>
  );
}

function ThreeWsPreview({ agentId }: { agentId: string }) {
  return (
    <div className="flex h-[78%] w-[58%] flex-col items-center justify-center gap-3 border border-gold-600/40 bg-night-700/60">
      <span className="font-display text-[11px] uppercase tracking-carved text-gold-300">
        agent-3d
      </span>
      <span className="readout text-[11px] text-stone-200">
        {agentId.slice(0, 16)}
        {agentId.length > 16 ? "…" : ""}
      </span>
      <span className="readout mt-1 text-[9px] uppercase tracking-wider text-stone-400">
        sprint 5 wires the live render
      </span>
    </div>
  );
}
