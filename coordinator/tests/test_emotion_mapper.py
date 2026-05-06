import pytest

from app.schemas.events import GladiusEvent
from app.services.emotion_mapper import annotate, map_event


def _event(type_: str, data: dict | None = None) -> GladiusEvent:
    return GladiusEvent(type=type_, season_id=1, timestamp=0, data=data or {})


def test_swap_detected_curiosity() -> None:
    assert map_event(_event("swap_detected")) == ("curiosity", 0.6)


@pytest.mark.parametrize(
    ("pnl_pct", "expected"),
    [
        (10.0, ("celebration", 0.95)),
        (3.0, ("celebration", 0.6)),
        (-10.0, ("concern", 0.9)),
        (-3.0, ("concern", 0.5)),
        (0.0, ("patience", 0.4)),
        (0.5, ("patience", 0.4)),
    ],
)
def test_balance_updated_branches(pnl_pct: float, expected: tuple[str, float]) -> None:
    assert map_event(_event("balance_updated", {"pnl_change_pct": pnl_pct})) == expected


@pytest.mark.parametrize(
    ("rank", "rank_change", "expected"),
    [
        (1, 0, ("celebration", 0.8)),
        (3, 1, ("celebration", 0.8)),
        (5, -2, ("concern", 0.5)),
        (5, 2, ("patience", 0.3)),
    ],
)
def test_score_changed_branches(
    rank: int, rank_change: int, expected: tuple[str, float]
) -> None:
    event = _event("score_changed", {"rank": rank, "rank_change": rank_change})
    assert map_event(event) == expected


@pytest.mark.parametrize(
    ("final_rank", "expected"),
    [
        (1, ("celebration", 1.0)),
        (3, ("celebration", 1.0)),
        (10, ("empathy", 0.4)),
    ],
)
def test_season_ended_branches(final_rank: int, expected: tuple[str, float]) -> None:
    assert map_event(_event("season_ended", {"final_rank": final_rank})) == expected


def test_season_started_returns_no_hint() -> None:
    assert map_event(_event("season_started")) is None


def test_annotate_writes_emotion_hint() -> None:
    event = annotate(_event("swap_detected"))
    assert event.emotion_hint == "curiosity:0.60"


def test_annotate_leaves_unmapped_events_unchanged() -> None:
    event = annotate(_event("season_started"))
    assert event.emotion_hint is None
