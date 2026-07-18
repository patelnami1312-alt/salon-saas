from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.core.ws_manager import appointment_sync

router = APIRouter()


@router.websocket("/ws/appointments")
async def appointments_ws(
    websocket: WebSocket,
    token: str = Query(...),
    salon_id: int = Query(...),
):
    """
    Real-time appointment sync via WebSocket.
    Auth via JWT query param (WebSocket protocol does not support custom headers).
    Clients subscribe to a salon_id; all appointment mutations are broadcast here.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4001)
            return
        token_salon = payload.get("salon_id")
        role = payload.get("role", "")
        # Super admin can subscribe to any salon; others must own the salon
        if role != "super_admin" and token_salon is not None and int(token_salon) != salon_id:
            await websocket.close(code=4003)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await appointment_sync.connect(salon_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "salon_id": salon_id})
        # Keep connection alive — client sends periodic pings
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        appointment_sync.disconnect(salon_id, websocket)
