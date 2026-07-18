import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, OwnerOrAbove
from app.models.salon import Salon, Branch
from app.models.user import User



router = APIRouter(prefix="/salon", tags=["Salon Settings"])

SETTINGS_KEYS = {
    "locale", "date_format", "time_format",
    "tax_percent", "loyalty_points_per_currency", "loyalty_points_redemption_rate",
    "appointment_reminder", "birthday_wishes", "marketing_emails", "sms_alerts",
}


def _parse_settings(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


@router.get("/settings")
async def get_salon_settings(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    extra = _parse_settings(salon.Settings)

    return {
        "salon_id": salon.SalonID,
        "salon_name": salon.SalonName,
        "email": salon.Email,
        "phone": salon.Phone or "",
        "address": salon.Address or "",
        # Locale / region
        "currency": salon.Currency or "USD",
        "timezone": salon.Timezone or "UTC",
        "locale": extra.get("locale", "en-US"),
        "date_format": extra.get("date_format", "MMM D, YYYY"),
        "time_format": extra.get("time_format", "12h"),
        # Business rules
        "tax_percent": extra.get("tax_percent", 0),
        "loyalty_points_per_currency": extra.get("loyalty_points_per_currency", 1),
        "loyalty_points_redemption_rate": extra.get("loyalty_points_redemption_rate", 0.01),
        # Notification prefs
        "appointment_reminder": extra.get("appointment_reminder", True),
        "birthday_wishes": extra.get("birthday_wishes", True),
        "marketing_emails": extra.get("marketing_emails", False),
        "sms_alerts": extra.get("sms_alerts", True),
    }


@router.put("/settings")
async def update_salon_settings(
    payload: dict,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(OwnerOrAbove()),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    extra = _parse_settings(salon.Settings)

    # Update top-level Salon columns
    if "salon_name" in payload:
        salon.SalonName = payload["salon_name"]
    if "phone" in payload:
        salon.Phone = payload["phone"]
    if "address" in payload:
        salon.Address = payload["address"]
    if "currency" in payload:
        salon.Currency = payload["currency"]
    if "timezone" in payload:
        salon.Timezone = payload["timezone"]

    # Update JSON settings blob
    for key in SETTINGS_KEYS:
        if key in payload:
            extra[key] = payload[key]

    salon.Settings = json.dumps(extra)
    await db.commit()

    return {"success": True, "message": "Settings updated"}


def _branch_dict(b: Branch) -> dict:
    return {
        "branch_id": b.BranchID,
        "salon_id": b.SalonID,
        "branch_name": b.BranchName,
        "branch_code": b.BranchCode,
        "phone": b.Phone,
        "email": b.Email,
        "address": b.Address,
        "city": b.City,
        "state": b.State,
        "postal_code": b.PostalCode,
        "country": b.Country,
        "opening_time": str(b.OpeningTime) if b.OpeningTime else None,
        "closing_time": str(b.ClosingTime) if b.ClosingTime else None,
        "slot_duration": b.SlotDuration,
        "is_active": b.IsActive,
    }


@router.get("/branches")
async def get_salon_branches(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Branch).where(Branch.SalonID == salon_id).order_by(Branch.BranchID)
    )
    branches = result.scalars().all()
    return [_branch_dict(b) for b in branches]


@router.post("/branches", status_code=201)
async def create_branch(
    payload: dict,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(OwnerOrAbove()),
):
    from datetime import time as dt_time

    def parse_time(s: str | None):
        if not s:
            return None
        parts = s.split(":")
        return dt_time(int(parts[0]), int(parts[1]))

    branch = Branch(
        SalonID=salon_id,
        BranchName=payload["branch_name"],
        BranchCode=payload.get("branch_code"),
        Phone=payload.get("phone"),
        Email=payload.get("email"),
        Address=payload.get("address"),
        City=payload.get("city"),
        State=payload.get("state"),
        PostalCode=payload.get("postal_code"),
        Country=payload.get("country", "US"),
        OpeningTime=parse_time(payload.get("opening_time")),
        ClosingTime=parse_time(payload.get("closing_time")),
        SlotDuration=payload.get("slot_duration", 30),
        IsActive=payload.get("is_active", True),
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return _branch_dict(branch)


@router.put("/branches/{branch_id}")
async def update_branch(
    branch_id: int,
    payload: dict,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(OwnerOrAbove()),
):
    from datetime import time as dt_time

    result = await db.execute(select(Branch).where(Branch.BranchID == branch_id, Branch.SalonID == salon_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    def parse_time(s: str | None):
        if not s:
            return None
        parts = s.split(":")
        return dt_time(int(parts[0]), int(parts[1]))

    for field, col in [
        ("branch_name", "BranchName"), ("branch_code", "BranchCode"), ("phone", "Phone"),
        ("email", "Email"), ("address", "Address"), ("city", "City"), ("state", "State"),
        ("postal_code", "PostalCode"), ("country", "Country"),
        ("slot_duration", "SlotDuration"), ("is_active", "IsActive"),
    ]:
        if field in payload:
            setattr(branch, col, payload[field])

    if "opening_time" in payload:
        branch.OpeningTime = parse_time(payload["opening_time"])
    if "closing_time" in payload:
        branch.ClosingTime = parse_time(payload["closing_time"])

    await db.commit()
    return _branch_dict(branch)
