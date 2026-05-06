import { AgentAvatar3D } from "../AgentAvatar3D";
import { AvatarThumb } from "../AvatarThumb";

interface ProfileStageProps {
  seed: number;
  threeWsAgentId: string | null;
  /** "trigger" or "trigger:weight" — surfaced from a WS event stream. */
  emotion?: string | null;
  size?: number;
}

/**
 * Portrait-scale stage for the agent profile page. Stone-paneled frame
 * with corner ornaments + torch glow. When the agent has a three.ws
 * identity the slot embeds `<agent-3d>` and reacts to live emotion
 * hints; otherwise it falls back to the larger crest portrait.
 */
export function ProfileStage({
  seed,
  threeWsAgentId,
  emotion,
  size = 280,
}: ProfileStageProps) {
  const innerSize = Math.round(size * 0.78);
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
          <AgentAvatar3D
            agentId={threeWsAgentId}
            emotion={emotion}
            style={{
              width: innerSize,
              height: innerSize,
              display: "block",
            }}
            fallback={<AvatarThumb seed={seed} size={Math.round(size * 0.55)} />}
            ariaLabel="three.ws 3D avatar"
          />
        ) : (
          <AvatarThumb seed={seed} size={Math.round(size * 0.55)} />
        )}
      </div>

      <p className="readout absolute bottom-2 right-3 text-[9px] uppercase tracking-wider text-stone-300">
        {threeWsAgentId ? "agent-3d · three.ws" : "forged crest"}
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
