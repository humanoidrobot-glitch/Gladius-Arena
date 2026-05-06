"""Map a GladiusEvent to a (emotion, weight) hint for three.ws avatars.

three.ws supports five emotion triggers: celebration, concern, curiosity,
empathy, patience. The hint is informational — clients call
`<agent-3d>.expressEmotion(trigger, weight)` directly. Mirrors the
reference TS implementation in GLADIUS_PROMPT.md.
"""

from app.schemas.events import GladiusEvent


def map_event(event: GladiusEvent) -> tuple[str, float] | None:
    if event.type == "swap_detected":
        return ("curiosity", 0.6)

    if event.type == "balance_updated":
        pnl_change_pct = float(event.data.get("pnl_change_pct", 0.0))
        if pnl_change_pct > 5:
            return ("celebration", 0.95)
        if pnl_change_pct > 1:
            return ("celebration", 0.6)
        if pnl_change_pct < -5:
            return ("concern", 0.9)
        if pnl_change_pct < -1:
            return ("concern", 0.5)
        return ("patience", 0.4)

    if event.type == "score_changed":
        rank = int(event.data.get("rank", 0))
        rank_change = int(event.data.get("rank_change", 0))
        if 0 < rank <= 3:
            return ("celebration", 0.8)
        if rank_change < 0:
            return ("concern", 0.5)
        return ("patience", 0.3)

    if event.type == "season_ended":
        final_rank = int(event.data.get("final_rank", 0))
        if 0 < final_rank <= 3:
            return ("celebration", 1.0)
        return ("empathy", 0.4)

    return None


def annotate(event: GladiusEvent) -> GladiusEvent:
    """Set `emotion_hint` on the event in-place if a mapping applies."""
    hint = map_event(event)
    if hint is not None:
        event.emotion_hint = f"{hint[0]}:{hint[1]:.2f}"
    return event
