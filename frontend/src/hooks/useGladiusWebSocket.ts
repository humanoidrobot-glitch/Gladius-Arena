import { useEffect, useRef, useState } from "react";

import { makeMockSwapEvent } from "../lib/mockData";
import type { GladiusEvent } from "../lib/types";

type Status = "connecting" | "open" | "closed";

interface Options {
  seasonId: number;
  /** Maximum events to retain. Older events are evicted FIFO. */
  bufferSize?: number;
  /** When true, run a local mock stream instead of opening a real WS. */
  mock?: boolean;
}

interface Result {
  events: GladiusEvent[];
  status: Status;
  /** Most recent event, or null. Useful for triggering effects without
   *  re-running on every buffer eviction. */
  latest: GladiusEvent | null;
}

/**
 * Subscribes to /ws/events/{seasonId}. In mock mode (default during
 * Sprint 4 while the coordinator isn't deployed) it generates a steady
 * trickle of swap_detected events so the visuals are testable.
 */
export function useGladiusWebSocket({
  seasonId,
  bufferSize = 32,
  mock = true,
}: Options): Result {
  const [events, setEvents] = useState<GladiusEvent[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const seqRef = useRef(0);

  useEffect(() => {
    if (mock) {
      setStatus("open");
      const intervalMs = 1800;
      const handle = window.setInterval(() => {
        seqRef.current += 1;
        const event = makeMockSwapEvent(seqRef.current);
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > bufferSize ? next.slice(0, bufferSize) : next;
        });
      }, intervalMs);
      return () => {
        window.clearInterval(handle);
        setStatus("closed");
      };
    }

    const url = new URL(`/ws/events/${seasonId}`, window.location.origin);
    url.protocol = url.protocol.replace("http", "ws");
    const ws = new WebSocket(url.toString());
    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("closed");
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as GladiusEvent;
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > bufferSize ? next.slice(0, bufferSize) : next;
        });
      } catch {
        // ignore malformed payloads
      }
    };
    return () => ws.close();
  }, [seasonId, bufferSize, mock]);

  return {
    events,
    status,
    latest: events[0] ?? null,
  };
}
