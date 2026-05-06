interface AvatarThumbProps {
  seed: number;
  size?: number;
  rank?: number;
  threeWsLinked?: boolean;
}

const PALETTES: Array<{ ring: string; fill: string; mark: string }> = [
  { ring: "#c9a84c", fill: "#3a3119", mark: "#e0c060" }, // gold
  { ring: "#a0312f", fill: "#2a1815", mark: "#c63d3a" }, // blood
  { ring: "#5d8a4d", fill: "#1a2218", mark: "#7caa68" }, // emerald
  { ring: "#5a554c", fill: "#2a241c", mark: "#a8a294" }, // stone
];

/**
 * Deterministic gladiator portrait placeholder — circular gold-rimmed
 * disc with a stylized helm/crest. When `threeWsLinked` is set, a small
 * gold corner pip indicates the agent has a real three.ws identity that
 * the agent profile page renders as a full <agent-3d> viewer. The full
 * three.ws integration lands in Sprint 5.
 */
export function AvatarThumb({
  seed,
  size = 56,
  rank,
  threeWsLinked,
}: AvatarThumbProps) {
  const palette = PALETTES[seed % PALETTES.length];
  const isChampion = rank === 1;
  const ringWidth = isChampion ? 2 : 1;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{
          backgroundColor: palette.fill,
          boxShadow: isChampion
            ? "0 0 0 1px rgba(201,168,76,0.55), 0 0 22px -4px rgba(201,168,76,0.45)"
            : "inset 0 1px 0 0 rgba(201,168,76,0.18), 0 4px 12px -8px rgba(0,0,0,0.9)",
          border: `${ringWidth}px solid ${palette.ring}`,
        }}
      >
        <CrestMark seed={seed} color={palette.mark} />
      </div>
      {threeWsLinked && <ThreeWsPip />}
    </div>
  );
}

function ThreeWsPip() {
  // Small gold pip in the bottom-right of the avatar. Says "this agent
  // has a three.ws identity — the full 3D viewer renders on the profile
  // page" without needing to load <agent-3d> at thumbnail scale.
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-night-800"
      style={{
        border: "1px solid rgba(201, 168, 76, 0.85)",
        boxShadow: "0 0 6px rgba(201, 168, 76, 0.55)",
      }}
      title="three.ws avatar linked"
      aria-label="three.ws avatar linked"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-gold-300" aria-hidden>
        {/* Three triangular peaks — a tiny stylized "3" / mountains motif */}
        <path
          d="M2 9 L4 5 L6 9 Z M5 9 L7 4 L9 9 Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
      </svg>
    </span>
  );
}

function CrestMark({ seed, color }: { seed: number; color: string }) {
  const variant = seed % 4;
  const common = {
    fill: color,
    fillOpacity: 0.85,
    stroke: color,
    strokeWidth: 0.4,
  };
  return (
    <svg
      viewBox="0 0 32 32"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {variant === 0 && (
        <>
          <path
            d="M16 5 L16 22 M11 22 L21 22"
            stroke={color}
            strokeOpacity="0.6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <ellipse cx="16" cy="5" rx="4" ry="2.4" {...common} />
        </>
      )}
      {variant === 1 && (
        <>
          <path
            d="M9 9 L23 23 M23 9 L9 23"
            stroke={color}
            strokeOpacity="0.85"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="2.2" {...common} />
        </>
      )}
      {variant === 2 && (
        <>
          <path
            d="M8 18 Q11 8 16 6 Q21 8 24 18"
            fill="none"
            stroke={color}
            strokeOpacity="0.85"
            strokeWidth="1.4"
          />
          <circle cx="16" cy="20" r="1.8" {...common} />
        </>
      )}
      {variant === 3 && (
        <>
          <path d="M16 6 L17 22 L16 25 L15 22 Z" {...common} />
          <path
            d="M11 22 L21 22"
            stroke={color}
            strokeOpacity="0.7"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
