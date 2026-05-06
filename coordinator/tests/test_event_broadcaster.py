import asyncio

import pytest

from app.schemas.events import GladiusEvent
from app.services.event_broadcaster import EventBroadcaster


def _event(season_id: int = 1, type: str = "swap_detected") -> GladiusEvent:
    return GladiusEvent(type=type, season_id=season_id, timestamp=0)


async def test_publish_delivers_to_subscriber() -> None:
    bc = EventBroadcaster()
    q = bc.subscribe(season_id=1)
    await bc.publish(_event())
    received = await asyncio.wait_for(q.get(), timeout=1.0)
    assert received.type == "swap_detected"


async def test_publish_only_to_matching_season() -> None:
    bc = EventBroadcaster()
    q1 = bc.subscribe(season_id=1)
    q2 = bc.subscribe(season_id=2)
    await bc.publish(_event(season_id=1))
    assert (await asyncio.wait_for(q1.get(), timeout=1.0)).season_id == 1
    assert q2.empty()


async def test_unsubscribe_stops_delivery() -> None:
    bc = EventBroadcaster()
    q = bc.subscribe(season_id=1)
    bc.unsubscribe(season_id=1, queue=q)
    await bc.publish(_event())
    assert q.empty()
    assert bc.subscriber_count(1) == 0


async def test_multiple_subscribers_each_receive() -> None:
    bc = EventBroadcaster()
    queues = [bc.subscribe(season_id=1) for _ in range(3)]
    await bc.publish(_event())
    for q in queues:
        assert (await asyncio.wait_for(q.get(), timeout=1.0)).season_id == 1


async def test_publish_drops_event_for_full_queue() -> None:
    """Slow subscriber must not block other subscribers or publishers."""
    bc = EventBroadcaster()
    fast = bc.subscribe(season_id=1)
    slow = bc.subscribe(season_id=1)

    # Fill slow queue to capacity without consuming
    for i in range(slow.maxsize):
        slow.put_nowait(_event())

    # Publish should not raise even though `slow` is full
    await bc.publish(_event())

    # Fast subscriber still got the latest event
    assert not fast.empty()


def test_websocket_smoke_via_starlette_testclient() -> None:
    """One end-to-end check that the WS route accepts a connection and
    forwards published events."""
    from fastapi.testclient import TestClient

    from app.main import app
    from app.services.event_broadcaster import broadcaster as singleton

    with TestClient(app) as test_client:
        with test_client.websocket_connect("/ws/events/42") as ws:
            assert singleton.subscriber_count(42) == 1

            async def _publish() -> None:
                await singleton.publish(_event(season_id=42, type="score_changed"))

            asyncio.run(_publish())

            payload = ws.receive_json()
            assert payload["type"] == "score_changed"
            assert payload["season_id"] == 42
