interface AvatarStageProps {
  label?: string;
  height?: number;
}

/**
 * Ceremonial stage: two stone columns flank a placeholder area where
 * a `<agent-3d>` web component will eventually render. The component
 * itself isn't wired yet — Sprint 5 lands the three.ws integration —
 * but the stage geometry is final.
 */
export function AvatarStage({ label = "Avatar", height = 360 }: AvatarStageProps) {
  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ height }}>
      <Column side="left" />
      <Column side="right" />
      <Plinth />
      <div className="absolute inset-x-16 bottom-12 top-6 flex items-center justify-center">
        <div className="stone-panel relative h-full w-full overflow-hidden rounded-sm border border-gold-700/40">
          <div className="absolute inset-0 bg-torch-light" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <p className="font-display text-[10px] uppercase tracking-carved text-gold-500/70">
              {label}
            </p>
            <p className="readout text-[11px] text-stone-400">
              {"<agent-3d>"} placeholder
            </p>
          </div>
        </div>
      </div>
    </div>
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
