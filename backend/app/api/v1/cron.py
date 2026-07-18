from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import settings
from app.tasks.background_tasks import (
    expire_memberships,
    pending_notifications_retry,
    send_appointment_reminders,
    send_birthday_wishes,
)

router = APIRouter(prefix="/cron", tags=["Cron"])


def _check_cron_secret(authorization: str | None) -> None:
    if not settings.CRON_SECRET or authorization != f"Bearer {settings.CRON_SECRET}":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


@router.get("/run")
async def run_scheduled_jobs(authorization: str | None = Header(default=None)):
    """
    Single entrypoint for all time-based jobs that used to run via an
    in-process APScheduler. There's no long-running process on Vercel to
    host that scheduler, so Vercel Cron hits this every 30 minutes instead
    (see vercel.json) and each job decides here whether it's actually due.
    """
    _check_cron_secret(authorization)

    now = datetime.now(timezone.utc)
    ran = []

    if now.hour == 8 and now.minute < 30:
        await send_appointment_reminders()
        ran.append("appointment_reminders")

    if now.hour == 9 and now.minute < 30:
        await send_birthday_wishes()
        ran.append("birthday_wishes")

    if now.hour == 0 and now.minute < 30:
        await expire_memberships()
        ran.append("expire_memberships")

    await pending_notifications_retry()
    ran.append("retry_notifications")

    return {"ran": ran, "at": now.isoformat()}
