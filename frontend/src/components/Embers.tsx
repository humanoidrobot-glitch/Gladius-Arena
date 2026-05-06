interface EmbersProps {
  count?: number;
  intensity?: "subtle" | "active";
}

interface EmberTier {
  /** Background gradient — embers have a hot bright core that fades to a darker rim. */
  background: string;
  /** Layered glow halo. */
  glow: string;
  /** Size multiplier — fresh embers are biggest, cool dust is smallest. */
  scale: number;
}

/**
 * Three temperature tiers — fresh (vivid red-orange), warm (orange-gold),
 * cool (dim amber) — distributed across the population so the field looks
 * like a real fire bed rather than uniform gold dust. Each ember combines
 * `ember-rise` (path with horizontal sway via --drift) with
 * `ember-flicker` (rapid brightness variation) to mimic flame turbulence.
 */
const TIERS: EmberTier[] = [
  // Fresh ember: vivid red-orange core, hottest, biggest glow.
  {
    background:
      "radial-gradient(circle at 50% 40%, #fff2c4 0%, #ffb148 25%, #ff6418 60%, #c2310a 100%)",
    glow:
      "0 0 8px rgba(255, 130, 50, 1), 0 0 18px rgba(255, 90, 25, 0.7), 0 0 36px rgba(220, 60, 15, 0.45)",
    scale: 1.0,
  },
  // Warm ember: orange-gold, mid-temperature.
  {
    background:
      "radial-gradient(circle at 50% 40%, #ffe9b8 0%, #ffb74a 35%, #f08820 70%, #a04a14 100%)",
    glow:
      "0 0 6px rgba(255, 175, 80, 0.95), 0 0 14px rgba(230, 130, 40, 0.6), 0 0 28px rgba(180, 80, 25, 0.3)",
    scale: 0.85,
  },
  // Cool ember: dim amber/gold, near-extinguished — drifts highest, smallest.
  {
    background:
      "radial-gradient(circle at 50% 40%, #ffe0a0 0%, #e5b85a 50%, #b07832 100%)",
    glow:
      "0 0 4px rgba(229, 184, 90, 0.85), 0 0 10px rgba(201, 168, 76, 0.5), 0 0 20px rgba(160, 110, 45, 0.22)",
    scale: 0.65,
  },
];

export function Embers({ count = 42, intensity = "subtle" }: EmbersProps) {
  const opacityScale = intensity === "active" ? 1 : 0.95;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: count }).map((_, i) => {
        const tier = TIERS[i % TIERS.length];
        // Spawn distribution biased slightly toward the center so the
        // edges stay sparser — gives a focal point, like a fire bed.
        const rawLeft = (i * 41 + 7) % 100;
        const left = 8 + rawLeft * 0.84;
        const delay = (i * 0.79) % 12;
        const riseSpeed = 8 + ((i * 1.7) % 8);
        const flickerSpeed = 0.35 + ((i * 0.13) % 0.7);
        // Size 2-6px so the gradient core is actually visible.
        const sizeBase = 2 + ((i * 0.9) % 4);
        const size = sizeBase * tier.scale;
        const drift = ((i * 17 + 3) % 110) - 55;

        return (
          <span
            key={i}
            className="absolute bottom-0 rounded-full"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: tier.background,
              opacity: opacityScale,
              boxShadow: tier.glow,
              animation: `ember-rise ${riseSpeed}s linear ${delay}s infinite, ember-flicker ${flickerSpeed}s ease-in-out infinite`,
              ["--drift" as string]: `${drift}px`,
            }}
          />
        );
      })}
    </div>
  );
}
