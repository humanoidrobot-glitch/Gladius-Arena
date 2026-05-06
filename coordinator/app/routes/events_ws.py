import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.event_broadcaster import broadcaster

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/events/{season_id}")
async def events_ws(websocket: WebSocket, season_id: int) -> None:
    await websocket.accept()
    queue = broadcaster.subscribe(season_id)
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event.model_dump(mode="json"))
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.unsubscribe(season_id, queue)
