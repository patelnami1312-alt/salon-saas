import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket
from loguru import logger


class AppointmentSyncManager:
    """
    Tracks WebSocket connections per salon.

    Delivery model:
    - Direct broadcast: instant, same-worker only.
    - Redis backplane (start_backplane): fan-out to ALL workers via pub/sub,
      ~200ms latency (driven by outbox relay interval). This is what makes
      multi-worker deployments work correctly.
    """

    def __init__(self):
        self._connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, salon_id: int, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(salon_id, set()).add(websocket)

    def disconnect(self, salon_id: int, websocket: WebSocket):
        if salon_id in self._connections:
            self._connections[salon_id].discard(websocket)
            if not self._connections[salon_id]:
                del self._connections[salon_id]

    async def broadcast(self, salon_id: int, message: dict):
        conns = self._connections.get(salon_id, set()).copy()
        if not conns:
            return
        payload = json.dumps(message, default=str)
        dead = []
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(salon_id, ws)

    def connection_count(self, salon_id: int) -> int:
        return len(self._connections.get(salon_id, set()))

    async def start_backplane(self, redis_client) -> None:
        """
        Subscribe to the Redis 'salon_appointments' channel and fan out
        every message to local WebSocket connections.

        Must be started as an asyncio task (not awaited directly) so it runs
        concurrently with the rest of the application.
        """
        try:
            pubsub = redis_client.pubsub()
            await pubsub.subscribe("salon_appointments")
            logger.info("WS backplane: subscribed to Redis channel 'salon_appointments'")
            async for msg in pubsub.listen():
                if msg["type"] != "message":
                    continue
                try:
                    event = json.loads(msg["data"])
                    salon_id = event.get("salon_id")
                    payload = event.get("payload")
                    if salon_id and payload:
                        await self.broadcast(salon_id, payload)
                except Exception as exc:
                    logger.warning(f"WS backplane: malformed message — {exc}")
        except asyncio.CancelledError:
            logger.info("WS backplane: task cancelled — shutting down")
        except Exception as exc:
            logger.error(f"WS backplane: fatal error — {exc}")


# Single instance shared across the app (asyncio single event loop)
appointment_sync = AppointmentSyncManager()
