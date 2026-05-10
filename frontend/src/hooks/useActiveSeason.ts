import { useEffect, useState } from "react";

import { listSeasons, type SeasonResponse } from "../lib/api";
import { pickFeaturedSeason } from "../lib/seasons";

export type ActiveSeasonStatus = "loading" | "ready" | "empty" | "error";

export interface ActiveSeasonState {
  status: ActiveSeasonStatus;
  season: SeasonResponse | null;
  error: string | null;
}

export function useActiveSeason(): ActiveSeasonState {
  const [state, setState] = useState<ActiveSeasonState>({
    status: "loading",
    season: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    listSeasons()
      .then((seasons) => {
        if (cancelled) return;
        const featured = pickFeaturedSeason(seasons);
        setState(
          featured
            ? { status: "ready", season: featured, error: null }
            : { status: "empty", season: null, error: null },
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          season: null,
          error: err instanceof Error ? err.message : "failed to load seasons",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
