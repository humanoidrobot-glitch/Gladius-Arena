import { ReactNode } from "react";

interface StepShellProps {
  numeral: string;
  title: string;
  state: "locked" | "active" | "complete";
  children: ReactNode;
}

export function StepShell({ numeral, title, state, children }: StepShellProps) {
  const isLocked = state === "locked";
  const isComplete = state === "complete";

  const numeralClass = isLocked
    ? "text-stone-500"
    : isComplete
      ? "text-gold-300"
      : "text-gold-200";

  const titleClass = isLocked
    ? "text-stone-400"
    : isComplete
      ? "text-gold-100"
      : "text-stone-50";

  return (
    <section
      className="stone-panel relative border border-stone-700/40 px-7 py-6"
      style={{ opacity: isLocked ? 0.55 : 1 }}
    >
      <header className="mb-5 flex items-baseline gap-4">
        <span
          className={`carved text-3xl ${numeralClass}`}
          style={{
            textShadow: isLocked
              ? "none"
              : "0 1px 0 rgba(0,0,0,0.9), 0 0 16px rgba(201,168,76,0.18)",
          }}
        >
          {numeral}
        </span>
        <h2
          className={`font-display text-xl uppercase tracking-imperial ${titleClass}`}
        >
          {title}
        </h2>
        {isComplete && <Sealed />}
      </header>
      <div className={isLocked ? "pointer-events-none" : ""}>{children}</div>
    </section>
  );
}

function Sealed() {
  return (
    <span className="ml-auto flex items-center gap-2">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-gold-300" aria-hidden>
        <path
          d="M3 8 L7 12 L13 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-[9px] uppercase tracking-carved text-gold-300">
        Sworn
      </span>
    </span>
  );
}
