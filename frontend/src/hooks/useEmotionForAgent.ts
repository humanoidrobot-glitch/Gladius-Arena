import { useMemo } from "react";

import type { GladiusEvent } from "../lib/types";

/**
 * Pull the most recent emotion_hint targeting a specific agent out of
 * a rolling event buffer. The avatar component watches this and calls
 * `expressEmotion(trigger, weight)` whenever the value changes.
 */
export function useEmotionForAgent(
  events: GladiusEvent[],
  agentId: number | null | undefined,
): string | null {
  return useMemo(() => {
    if (agentId == null) return null;
    for (const event of events) {
      if (event.agentId === agentId && event.emotionHint) {
        return event.emotionHint;
      }
    }
    return null;
  }, [events, agentId]);
}
