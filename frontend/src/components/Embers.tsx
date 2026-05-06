interface EmbersProps {
  count?: number;
  intensity?: "subtle" | "active";
}

/**
 * Ascending gold ember particles. Deterministic by index so the
 * server-rendered output and the client-rendered output stay aligned —
 * no hydration mismatch.
 */
export function Embers({ count = 28, intensity = "subtle" }: EmbersProps) {
  const opacityScale = intensity === "active" ? 1 : 0.7;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 37 + 13) % 100;
        const delay = (i * 0.83) % 9;
        const duration = 7 + ((i * 1.7) % 6);
        const size = 1 + ((i * 0.7) % 2.5);
        const drift = ((i * 11) % 30) - 15;
        return (
          <span
            key={i}
            className="absolute bottom-0 rounded-full bg-gold-200 animate-ember-rise"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: 0.75 * opacityScale,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              boxShadow:
                "0 0 6px rgba(234, 214, 163, 0.55), 0 0 14px rgba(201, 168, 76, 0.35)",
              ["--drift" as string]: `${drift}px`,
            }}
          />
        );
      })}
    </div>
  );
}
