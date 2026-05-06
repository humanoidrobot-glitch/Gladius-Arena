"""In-process pub/sub for season-scoped events.

Each subscriber gets a bounded `asyncio.Queue`. Slow subscribers don't
block publishers — `publish` uses `put_nowait` and silently drops events
on a full queue. For multi-replica deployments this needs to move to a
shared broker (Redis pubsub).
"""

import asyncio
import logging
from collections import defaultdict

from app.schemas.events import GladiusEvent
from app.services.emotion_mapper import annotate

logger = logging.getLogger(__name__)
_QUEUE_MAX = 100


class EventBroadcaster:
    def __init__(self) -> None:
        self._subs: dict[int, set[asyncio.Queue[GladiusEvent]]] = defaultdict(set)

    def subscribe(self, season_id: int) -> asyncio.Queue[GladiusEvent]:
        queue: asyncio.Queue[GladiusEvent] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subs[season_id].add(queue)
        return queue

    def unsubscribe(
        self, season_id: int, queue: asyncio.Queue[GladiusEvent]
    ) -> None:
        self._subs[season_id].discard(queue)
        if not self._subs[season_id]:
            del self._subs[season_id]

    async def publish(self, event: GladiusEvent) -> None:
        annotate(event)
        for queue in list(self._subs.get(event.season_id, ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "dropping event for slow subscriber: season=%s type=%s",
                    event.season_id,
                    event.type,
                )

    def subscriber_count(self, season_id: int) -> int:
        return len(self._subs.get(season_id, ()))


broadcaster = EventBroadcaster()
