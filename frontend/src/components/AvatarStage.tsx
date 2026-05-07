import { AgentAvatar3D } from "./AgentAvatar3D";

interface AvatarStageProps {
  /** three.ws agent id to feature on the stage. Falls back to a
   *  carved gladius+laurel emblem if unset / not yet loaded / failed. */
  agentId?: string | null;
  /** Optional GLB body URL — used when there's no three.ws id but a
   *  hosted glTF model is available. */
  body?: string | null;
  height?: number;
}

/**
 * Ceremonial stage: two stone columns flank the centerpiece. Renders a
 * live three.ws `<agent-3d>` viewer when an agent id (or GLB body) is
 * provided; otherwise (and during the brief window before the three.ws
 * script registers the custom element) shows a carved gladius+laurel
 * inscription as the fallback. Either way the stage frame is constant.
 */
export function AvatarStage({ agentId, body, height = 360 }: AvatarStageProps) {
  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ height }}>
      <Column side="left" />
      <Column side="right" />
      <Plinth />
      <div className="absolute inset-x-16 bottom-12 top-6 flex items-center justify-center">
        <div className="stone-panel relative h-full w-full overflow-hidden rounded-sm border border-gold-700/40">
          <div className="absolute inset-0 bg-torch-light" />
          <div className="absolute inset-0 flex items-center justify-center">
            <AgentAvatar3D
              agentId={agentId ?? null}
              body={body ?? null}
              ariaLabel="Featured Gladius champion"
              style={{ width: "100%", height: "100%", display: "block" }}
              fallback={<Inscription />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Carved fallback shown when no agent id is configured AND when the
 * three.ws script hasn't registered the custom element yet. Rendered
 * inside the same stone-panel area so the layout doesn't shift when
 * the live element takes over.
 */
function Inscription() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <p className="font-display text-[10px] uppercase tracking-carved text-gold-500/80">
        Phase I · the stage awaits
      </p>
      <Emblem />
      <div className="flex flex-col items-center gap-1.5">
        <p className="carved font-display text-base uppercase tracking-carved sm:text-lg">
          Quis · intrabit · primus
        </p>
        <p className="font-body text-sm italic text-stone-200 sm:text-base">
          Who shall enter first?
        </p>
      </div>
    </div>
  );
}

/**
 * Gladius (short sword) framed by a laurel arch — the literal Latin
 * etymology of the project. SVG paths kept hand-drawn rather than
 * pulled from an icon set so the line weight matches the rest of the
 * carved-gold aesthetic.
 */
function Emblem() {
  return (
    <svg
      viewBox="0 0 200 130"
      className="h-24 w-auto text-gold-300 drop-shadow-[0_2px_8px_rgba(201,168,76,0.25)] sm:h-28"
      aria-hidden
    >
      <defs>
        <linearGradient id="bladeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ead6a3" />
          <stop offset="55%" stopColor="#c9a84c" />
          <stop offset="100%" stopColor="#5e4e25" />
        </linearGradient>
        <linearGradient id="hiltGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a7233" />
          <stop offset="100%" stopColor="#3a3119" />
        </linearGradient>
      </defs>

      {/* Left laurel branch */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M30 95 Q22 60 50 30 Q72 14 100 12" />
        <path d="M28 80 Q18 78 14 70" />
        <path d="M30 65 Q19 60 18 50" />
        <path d="M38 50 Q28 42 30 32" />
        <path d="M52 36 Q44 26 50 16" />
        <path d="M70 22 Q66 12 74 6" />
      </g>

      {/* Right laurel branch */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M170 95 Q178 60 150 30 Q128 14 100 12" />
        <path d="M172 80 Q182 78 186 70" />
        <path d="M170 65 Q181 60 182 50" />
        <path d="M162 50 Q172 42 170 32" />
        <path d="M148 36 Q156 26 150 16" />
        <path d="M130 22 Q134 12 126 6" />
      </g>

      <circle cx="100" cy="11" r="2.5" fill="currentColor" opacity="0.9" />

      {/* Gladius — point up */}
      <path
        d="M97 28 L97 95 L100 100 L103 95 L103 28 Z"
        fill="url(#bladeGrad)"
      />
      <line
        x1="100"
        y1="32"
        x2="100"
        y2="92"
        stroke="rgba(255,237,200,0.55)"
        strokeWidth="0.6"
      />
      <rect
        x="86"
        y="98"
        width="28"
        height="3.5"
        rx="0.6"
        fill="url(#hiltGrad)"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <rect x="96" y="103" width="8" height="14" fill="url(#hiltGrad)" />
      <g stroke="rgba(0,0,0,0.55)" strokeWidth="0.5">
        <line x1="96" y1="106.5" x2="104" y2="106.5" />
        <line x1="96" y1="110" x2="104" y2="110" />
        <line x1="96" y1="113.5" x2="104" y2="113.5" />
      </g>
      <ellipse cx="100" cy="119" rx="6" ry="4" fill="url(#hiltGrad)" />
      <ellipse cx="100" cy="118" rx="2" ry="1" fill="rgba(234,214,163,0.5)" />
    </svg>
  );
}

function Column({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`absolute top-0 ${side === "left" ? "left-0" : "right-0"} flex h-full w-12 flex-col items-stretch`}
      aria-hidden
    >
      <Capital />
      <div className="flex-1 bg-night-700 bg-stone-grain shadow-chiseled">
        <div className="h-full w-full bg-gradient-to-b from-gold-700/10 via-transparent to-gold-700/15" />
      </div>
      <Base />
    </div>
  );
}

function Capital() {
  return (
    <div className="relative">
      <div className="h-2 w-full bg-gold-700/40" />
      <div className="-mx-1 h-3 bg-night-600 bg-stone-grain shadow-chiseled" />
      <div className="-mx-2 h-2 bg-night-700 bg-stone-grain shadow-chiseled" />
    </div>
  );
}

function Base() {
  return (
    <div className="relative">
      <div className="-mx-2 h-2 bg-night-700 bg-stone-grain shadow-chiseled" />
      <div className="-mx-1 h-3 bg-night-600 bg-stone-grain shadow-chiseled" />
      <div className="h-2 w-full bg-gold-700/40" />
    </div>
  );
}

function Plinth() {
  return (
    <div className="absolute inset-x-12 bottom-0 h-6 bg-night-600 bg-stone-grain shadow-chiseled">
      <div className="absolute inset-x-2 top-0 h-px bg-gold-700/40" />
    </div>
  );
}
