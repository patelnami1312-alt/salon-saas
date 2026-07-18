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
    host that scheduler, so Vercel Cron hits this once a day instead (see
    vercel.json) — Hobby-plan accounts can't schedule cron more often than
    daily, so all jobs run together in this one pass rather than each at
    their original separate time. Bump the schedule in vercel.json (and
    split this back into time-gated jobs) if you're on Pro and want the
    original cadence, especially for notification retries.
    """
    _check_cron_secret(authorization)

    now = datetime.now(timezone.utc)

    await send_appointment_reminders()
    await send_birthday_wishes()
    await expire_memberships()
    await pending_notifications_retry()

    ran = ["appointment_reminders", "birthday_wishes", "expire_memberships", "retry_notifications"]
    return {"ran": ran, "at": now.isoformat()}
