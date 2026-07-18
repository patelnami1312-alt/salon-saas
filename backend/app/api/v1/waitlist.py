from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import date

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, get_branch_id
from app.models.appointment import Waitlist
from app.models.customer import Customer
from app.models.service import Service
from app.models.staff import Staff
from app.models.user import User

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


def _waitlist_dict(w: Waitlist) -> dict:
    return {
        "waitlist_id": w.WaitlistID,
        "branch_id": w.BranchID,
        "customer_id": w.CustomerID,
        "customer_name": w.customer.full_name if w.customer else None,
        "customer_phone": w.customer.Mobile if w.customer else None,
        "service_id": w.ServiceID,
        "service_name": w.service.ServiceName if w.service else None,
        "service_duration": w.service.Duration if w.service else None,
        "staff_id": w.StaffID,
        "staff_name": w.staff.user.full_name if (w.staff and w.staff.user) else None,
        "preferred_date": w.PreferredDate.isoformat() if w.PreferredDate else None,
        "preferred_time": str(w.PreferredTime) if w.PreferredTime else None,
        "status": w.Status,
        "notes": w.Notes,
        "created_at": w.CreatedAt.isoformat() if w.CreatedAt else None,
    }


@router.get("")
async def list_waitlist(
    preferred_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    service_id: Optional[int] = Query(None),
    staff_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_db),
    branch_id: Optional[int] = Depends(get_branch_id),
):
    q = (
        select(Waitlist)
        .options(
            selectinload(Waitlist.customer),
            selectinload(Waitlist.service),
            selectinload(Waitlist.staff).selectinload(Staff.user),
        )
    )
    if branch_id:
        q = q.where(Waitlist.BranchID == branch_id)
    if preferred_date:
        q = q.where(Waitlist.PreferredDate == preferred_date)
    if status:
        q = q.where(Waitlist.Status == status)
    else:
        q = q.where(Waitlist.Status == "Waiting")
    if service_id:
        q = q.where(Waitlist.ServiceID == service_id)
    if staff_id:
        q = q.where(Waitlist.StaffID == staff_id)

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size).order_by(Waitlist.CreatedAt)
    result = await db.execute(q)
    items = result.scalars().all()

    return {"total": total, "page": page, "page_size": page_size, "items": [_waitlist_dict(w) for w in items]}


@router.post("", status_code=201)
async def add_to_waitlist(
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    branch_id: Optional[int] = Depends(get_branch_id),
):
    if not branch_id and not body.get("branch_id"):
        raise HTTPException(status_code=400, detail="Branch ID required")

    from datetime import time as dt_time
    preferred_time = None
    if body.get("preferred_time"):
        parts = body["preferred_time"].split(":")
        preferred_time = dt_time(int(parts[0]), int(parts[1]))

    entry = Waitlist(
        BranchID=body.get("branch_id") or branch_id,
        CustomerID=body["customer_id"],
        ServiceID=body["service_id"],
        StaffID=body.get("staff_id"),
        PreferredDate=date.fromisoformat(body["preferred_date"]) if body.get("preferred_date") else None,
        PreferredTime=preferred_time,
        Status="Waiting",
        Notes=body.get("notes"),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    result = await db.execute(
        select(Waitlist)
        .options(
            selectinload(Waitlist.customer),
            selectinload(Waitlist.service),
            selectinload(Waitlist.staff).selectinload(Staff.user),
        )
        .where(Waitlist.WaitlistID == entry.WaitlistID)
    )
    return _waitlist_dict(result.scalar_one())


@router.put("/{waitlist_id}")
async def update_waitlist_entry(
    waitlist_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    branch_id: Optional[int] = Depends(get_branch_id),
):
    query = select(Waitlist).where(Waitlist.WaitlistID == waitlist_id)
    if branch_id:
        query = query.where(Waitlist.BranchID == branch_id)
    result = await db.execute(query)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    for field, col in [
        ("status", "Status"), ("notes", "Notes"), ("staff_id", "StaffID"),
    ]:
        if field in body:
            setattr(entry, col, body[field])

    if "preferred_date" in body:
        entry.PreferredDate = date.fromisoformat(body["preferred_date"]) if body["preferred_date"] else None
    if "preferred_time" in body and body["preferred_time"]:
        from datetime import time as dt_time
        parts = body["preferred_time"].split(":")
        entry.PreferredTime = dt_time(int(parts[0]), int(parts[1]))

    await db.commit()
    return {"message": "Waitlist entry updated"}


@router.post("/{waitlist_id}/book")
async def book_from_waitlist(
    waitlist_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Depends(get_branch_id),
):
    """Convert a waitlist entry to an appointment."""
    query = (
        select(Waitlist)
        .options(selectinload(Waitlist.service))
        .where(Waitlist.WaitlistID == waitlist_id)
    )
    if branch_id:
        query = query.where(Waitlist.BranchID == branch_id)
    result = await db.execute(query)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    from app.models.appointment import Appointment
    from datetime import time as dt_time
    import math

    start_time_str = body["start_time"]
    parts = start_time_str.split(":")
    start_time = dt_time(int(parts[0]), int(parts[1]))

    duration = entry.service.Duration if entry.service else 60
    end_hour = int(parts[0]) + math.floor((int(parts[1]) + duration) / 60)
    end_min = (int(parts[1]) + duration) % 60
    end_time = dt_time(min(end_hour, 23), end_min)

    appt = Appointment(
        SalonID=salon_id,
        BranchID=entry.BranchID,
        CustomerID=entry.CustomerID,
        StaffID=entry.StaffID,
        ServiceID=entry.ServiceID,
        AppointmentDate=date.fromisoformat(body["appointment_date"]),
        StartTime=start_time,
        EndTime=end_time,
        Status="Scheduled",
        BookingSource="Waitlist",
        CreatedByUserID=current_user.UserID,
    )
    db.add(appt)

    entry.Status = "Booked"
    await db.commit()

    return {"message": "Appointment booked from waitlist", "appointment_id": appt.AppointmentID}


@router.delete("/{waitlist_id}")
async def remove_from_waitlist(
    waitlist_id: int,
    db: AsyncSession = Depends(get_async_db),
    branch_id: Optional[int] = Depends(get_branch_id),
):
    query = select(Waitlist).where(Waitlist.WaitlistID == waitlist_id)
    if branch_id:
        query = query.where(Waitlist.BranchID == branch_id)
    result = await db.execute(query)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    entry.Status = "Cancelled"
    await db.commit()
    return {"message": "Removed from waitlist"}
