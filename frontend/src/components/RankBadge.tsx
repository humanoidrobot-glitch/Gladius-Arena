interface RankBadgeProps {
  rank: number;
}

/**
 * Carved rank number in Cinzel. Rank 1 wears a laurel wreath; ranks 2-3
 * pick up a thinner gold cartouche. The rest are stone-numbered.
 */
export function RankBadge({ rank }: RankBadgeProps) {
  const isChampion = rank === 1;
  const isPodium = rank <= 3;

  return (
    <div className="relative flex w-20 shrink-0 items-center justify-center">
      {isChampion && <Laurel />}
      <span
        className={`carved relative ${
          isPodium ? "text-gold-200" : "text-stone-300"
        }`}
        style={{
          fontSize: isChampion ? "3.25rem" : "2.5rem",
          lineHeight: 1,
          fontWeight: isPodium ? 700 : 500,
          textShadow: isPodium
            ? "0 1px 0 rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8), 0 0 18px rgba(201,168,76,0.25)"
            : "0 1px 0 rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.7)",
        }}
      >
        {rank}
      </span>
    </div>
  );
}

function Laurel() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="absolute inset-0 h-full w-full text-gold-400"
      aria-hidden
    >
      {/* Two arching laurel branches meeting at top, slim leaves along each. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        {/* Left branch */}
        <path d="M22 70 Q14 45 30 22" />
        {/* Right branch */}
        <path d="M74 70 Q82 45 66 22" />
      </g>
      {/* Leaves left side */}
      {[
        [20, 60, -55],
        [18, 50, -45],
        [19, 40, -35],
        [22, 30, -22],
        [27, 22, -10],
      ].map(([x, y, rot], i) => (
        <ellipse
          key={`l-${i}`}
          cx={x}
          cy={y}
          rx={3.2}
          ry={1.6}
          fill="currentColor"
          fillOpacity={0.55}
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ))}
      {/* Leaves right side */}
      {[
        [76, 60, 55],
        [78, 50, 45],
        [77, 40, 35],
        [74, 30, 22],
        [69, 22, 10],
      ].map(([x, y, rot], i) => (
        <ellipse
          key={`r-${i}`}
          cx={x}
          cy={y}
          rx={3.2}
          ry={1.6}
          fill="currentColor"
          fillOpacity={0.55}
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ))}
      {/* Tie at the bottom — small ribbon */}
      <path
        d="M40 76 L48 72 L56 76 L52 80 L48 78 L44 80 Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
    </svg>
  );
}
