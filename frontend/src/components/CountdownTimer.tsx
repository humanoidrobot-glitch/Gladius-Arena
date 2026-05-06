import { useEffect, useState } from "react";

interface CountdownProps {
  /** Unix ms target time. */
  endsAt: number;
  label?: string;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function compute(endsAt: number): Remaining {
  const ms = Math.max(0, endsAt - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: totalSeconds === 0,
  };
}

export function CountdownTimer({ endsAt, label = "Season I closes in" }: CountdownProps) {
  const [t, setT] = useState<Remaining>(() => compute(endsAt));

  useEffect(() => {
    const id = window.setInterval(() => setT(compute(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {label}
      </p>
      <div className="flex items-baseline gap-4">
        <Unit value={t.days} unit="d" />
        <Separator />
        <Unit value={t.hours} unit="h" />
        <Separator />
        <Unit value={t.minutes} unit="m" />
        <Separator />
        <Unit value={t.seconds} unit="s" pulse />
      </div>
    </div>
  );
}

function Unit({ value, unit, pulse }: { value: number; unit: string; pulse?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={`readout text-3xl font-semibold text-gold-200 sm:text-4xl ${
          pulse ? "animate-gold-flicker" : ""
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="readout text-xs uppercase text-stone-400">{unit}</span>
    </div>
  );
}

function Separator() {
  return <span className="readout text-2xl text-gold-700">·</span>;
}
