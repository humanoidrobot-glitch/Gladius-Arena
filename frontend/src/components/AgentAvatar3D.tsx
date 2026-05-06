import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import type { AgentThreeDElement } from "../types/agent-3d";

interface AgentAvatar3DProps {
  /** three.ws agent identifier (a_xxx…) — preferred over `body`. */
  agentId?: string | null;
  /** Direct GLB URL fallback for gallery/custom uploads. */
  body?: string | null;
  /** "trigger" or "trigger:weight" — the emotion the avatar should express. */
  emotion?: string | null;
  /** Element shown when the three.ws script hasn't defined <agent-3d> yet. */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

/**
 * React wrapper around the three.ws `<agent-3d>` custom element.
 *
 * Two responsibilities:
 *   1. Render the element only once `customElements.get('agent-3d')`
 *      resolves — falls back to whatever `fallback` prop was given (the
 *      forged-crest placeholder, typically) until the script loads.
 *   2. When the `emotion` prop changes, parse a "trigger:weight" string
 *      and call `expressEmotion(trigger, weight)` on the underlying
 *      element so the avatar reacts visually to live trade events.
 */
export function AgentAvatar3D({
  agentId,
  body,
  emotion,
  fallback,
  className,
  style,
  ariaLabel,
}: AgentAvatar3DProps) {
  const ref = useRef<AgentThreeDElement>(null);
  const ready = useCustomElementReady("agent-3d");

  useEffect(() => {
    if (!ready || !emotion) return;
    const el = ref.current;
    if (!el || typeof el.expressEmotion !== "function") return;

    const [trigger, weightStr] = emotion.split(":");
    const weight = weightStr ? Number.parseFloat(weightStr) : 0.85;
    const ALLOWED = ["celebration", "concern", "curiosity", "empathy", "patience"] as const;
    if (!ALLOWED.includes(trigger as (typeof ALLOWED)[number])) return;
    if (!Number.isFinite(weight)) return;

    el.expressEmotion(trigger as (typeof ALLOWED)[number], weight);
  }, [ready, emotion]);

  if (!ready || (!agentId && !body)) {
    return <>{fallback ?? null}</>;
  }

  return (
    <agent-3d
      ref={ref as never}
      agent-id={agentId ?? undefined}
      body={body ?? undefined}
      className={className}
      style={style}
      aria-label={ariaLabel}
    />
  );
}

function useCustomElementReady(tag: string): boolean {
  const [ready, setReady] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.customElements) return false;
    return Boolean(window.customElements.get(tag));
  });

  useEffect(() => {
    if (ready || typeof window === "undefined" || !window.customElements) return;
    let cancelled = false;
    window.customElements
      .whenDefined(tag)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Script failed to load (offline, blocked, or 404) —
        // stay on the fallback indefinitely.
      });
    return () => {
      cancelled = true;
    };
  }, [tag, ready]);

  return ready;
}
