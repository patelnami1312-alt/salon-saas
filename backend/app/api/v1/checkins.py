from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ReceptionistOrAbove
from app.models.checkin import CheckIn
from app.models.customer import Customer
from app.models.staff import Staff
from app.models.service import Service
from app.models.user import User
from app.models.appointment import Appointment


async def _broadcast_checkin(event_type: str, checkin: CheckIn, salon_id: int, db: AsyncSession):
    """
    Write a checkin event to the outbox + direct-broadcast to same-worker clients.
    Relay publishes outbox → Redis → backplane fans out to all workers.
    """
    try:
        from app.core.ws_manager import appointment_sync
        from app.models.outbox import OutboxEvent
        from app.core.database import AsyncSessionLocal

        customer = (await db.execute(select(Customer).where(Customer.CustomerID == checkin.CustomerID))).scalar_one_or_none()
        service  = (await db.execute(select(Service).where(Service.ServiceID  == checkin.ServiceID))).scalar_one_or_none()
        staff_name = None
        if checkin.StaffID:
            staff = (await db.execute(select(Staff).where(Staff.StaffID == checkin.StaffID))).scalar_one_or_none()
            if staff:
                u = (await db.execute(select(User).where(User.UserID == staff.UserID))).scalar_one_or_none()
                staff_name = f"{u.FirstName} {u.LastName}" if u else None

        wait_minutes    = int((datetime.now() - checkin.CheckInTime).total_seconds() / 60)    if checkin.CheckInTime    else None
        service_minutes = int((datetime.now() - checkin.StartServiceTime).total_seconds() / 60) if checkin.StartServiceTime else None

        payload = {
            "type": f"checkin.{event_type}",
            "checkin": {
                "checkin_id":      checkin.CheckInID,
                "branch_id":       checkin.BranchID,
                "customer_id":     checkin.CustomerID,
                "customer_name":   f"{customer.FirstName} {customer.LastName}" if customer else None,
                "customer_mobile": customer.Mobile if customer else None,
                "service_id":      checkin.ServiceID,
                "service_name":    service.ServiceName if service else None,
                "service_price":    float(service.Price) if service and service.Price else 0,
                "service_duration": service.Duration if service else None,
                "staff_id":        checkin.StaffID,
                "staff_name":      staff_name,
                "status":          checkin.Status,
                "queue_number":    checkin.QueueNumber,
                "checkin_time":    checkin.CheckInTime.isoformat() if checkin.CheckInTime else None,
                "wait_minutes":    wait_minutes,
                "service_minutes": service_minutes,
                "appointment_id":  checkin.AppointmentID,
            },
        }

        # Write to outbox (separate session — called after main commit)
        async with AsyncSessionLocal() as session:
            session.add(OutboxEvent(
                salon_id=salon_id,
                event_type=f"checkin.{event_type}",
                payload=payload,
            ))
            await session.commit()

        # Direct broadcast for instant same-worker delivery
        await appointment_sync.broadcast(salon_id, payload)
    except Exception:
        pass  # never let a broadcast failure break the API response

router = APIRouter(prefix="/checkins", tags=["Check-In"])


class CheckInCreate(BaseModel):
    branch_id: int
    customer_id: int
    service_id: int
    staff_id: Optional[int] = None
    appointment_id: Optional[int] = None
    notes: Optional[str] = None


class CheckInStatusUpdate(BaseModel):
    status: str
    staff_id: Optional[int] = None
    notes: Optional[str] = None


@router.get("/queue")
async def get_queue(
    branch_id: int = Query(...),
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(CheckIn).where(
            CheckIn.BranchID == branch_id,
            CheckIn.Status.in_(["Waiting", "CheckedIn", "InService"]),
        ).order_by(CheckIn.QueueNumber.asc())
    )
    checkins = result.scalars().all()

    queue = []
    for c in checkins:
        customer = (await db.execute(select(Customer).where(Customer.CustomerID == c.CustomerID))).scalar_one_or_none()
        service = (await db.execute(select(Service).where(Service.ServiceID == c.ServiceID))).scalar_one_or_none()
        staff_info = None
        if c.StaffID:
            staff = (await db.execute(select(Staff).where(Staff.StaffID == c.StaffID))).scalar_one_or_none()
            if staff:
                user = (await db.execute(select(User).where(User.UserID == staff.UserID))).scalar_one_or_none()
                staff_info = f"{user.FirstName} {user.LastName}" if user else None

        wait_minutes = None
        if c.CheckInTime:
            wait_minutes = int((datetime.now() - c.CheckInTime).total_seconds() / 60)

        service_minutes = None
        if c.StartServiceTime:
            service_minutes = int((datetime.now() - c.StartServiceTime).total_seconds() / 60)

        queue.append({
            "checkin_id": c.CheckInID,
            "queue_number": c.QueueNumber,
            "customer_id": c.CustomerID,
            "customer_name": f"{customer.FirstName} {customer.LastName}" if customer else None,
            "customer_mobile": customer.Mobile if customer else None,
            "service_id": c.ServiceID,
            "service_name": service.ServiceName if service else None,
            "service_price": float(service.Price) if service and service.Price else 0,
            "service_duration": service.Duration if service else None,
            "staff_id": c.StaffID,
            "staff_name": staff_info,
            "status": c.Status,
            "checkin_time": c.CheckInTime,
            "start_service_time": c.StartServiceTime,
            "wait_minutes": wait_minutes,
            "service_minutes": service_minutes,
            "appointment_id": c.AppointmentID,
            "notes": c.Notes,
        })

    return {"branch_id": branch_id, "queue": queue, "total": len(queue)}


@router.get("/lookup")
async def lookup_by_phone(
    phone: str = Query(..., min_length=3),
    branch_id: int = Query(...),
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    """
    Used by the check-in keypad: match a phone number to a customer, and if
    found, surface any of today's scheduled appointments at this branch that
    haven't been checked in yet — so reception can confirm/check-in the
    booking instead of re-entering it as a walk-in.
    """
    digits = "".join(ch for ch in phone if ch.isdigit())

    customer = (await db.execute(
        select(Customer)
        .where(
            Customer.SalonID == salon_id,
            func.regexp_replace(Customer.Mobile, r"[^0-9]", "", "g").like(f"%{digits}"),
        )
        .limit(1)
    )).scalars().first()

    if not customer:
        return {"customer": None, "appointments": []}

    appts_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.CustomerID == customer.CustomerID,
            Appointment.BranchID == branch_id,
            Appointment.AppointmentDate == date.today(),
            Appointment.Status.in_(["Scheduled", "Confirmed"]),
        )
        .order_by(Appointment.StartTime.asc())
    )
    appointments = []
    for a in appts_result.scalars().all():
        service = (await db.execute(select(Service).where(Service.ServiceID == a.ServiceID))).scalar_one_or_none()
        staff_name = None
        if a.StaffID:
            staff = (await db.execute(select(Staff).where(Staff.StaffID == a.StaffID))).scalar_one_or_none()
            if staff:
                user = (await db.execute(select(User).where(User.UserID == staff.UserID))).scalar_one_or_none()
                staff_name = f"{user.FirstName} {user.LastName}" if user else None
        appointments.append({
            "appointment_id": a.AppointmentID,
            "service_id": a.ServiceID,
            "service_name": service.ServiceName if service else None,
            "service_price": float(service.Price) if service else 0,
            "staff_id": a.StaffID,
            "staff_name": staff_name,
            "start_time": a.StartTime.strftime("%H:%M") if a.StartTime else None,
        })

    return {
        "customer": {
            "customer_id": customer.CustomerID,
            "full_name": f"{customer.FirstName} {customer.LastName}",
            "mobile": customer.Mobile,
        },
        "appointments": appointments,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_checkin(
    data: CheckInCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    queue_result = await db.execute(
        select(func.max(CheckIn.QueueNumber)).where(
            CheckIn.BranchID == data.branch_id,
            func.date(CheckIn.CheckInTime) == func.date(func.now()),
        )
    )
    max_queue = queue_result.scalar() or 0
    queue_number = max_queue + 1

    checkin = CheckIn(
        BranchID=data.branch_id,
        CustomerID=data.customer_id,
        ServiceID=data.service_id,
        StaffID=data.staff_id,
        AppointmentID=data.appointment_id,
        QueueNumber=queue_number,
        Status="Waiting",
        Notes=data.notes,
        CreatedByUserID=current_user.UserID,
    )
    db.add(checkin)

    if data.appointment_id:
        from app.models.appointment import Appointment
        appt = (await db.execute(
            select(Appointment).where(Appointment.AppointmentID == data.appointment_id)
        )).scalar_one_or_none()
        if appt:
            appt.Status = "CheckedIn"

    await db.commit()
    await db.refresh(checkin)
    await _broadcast_checkin("created", checkin, salon_id, db)
    return {"checkin_id": checkin.CheckInID, "queue_number": queue_number, "status": checkin.Status}


@router.put("/{checkin_id}/status")
async def update_checkin_status(
    checkin_id: int,
    data: CheckInStatusUpdate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(select(CheckIn).where(CheckIn.CheckInID == checkin_id))
    checkin = result.scalar_one_or_none()
    if not checkin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found")

    valid_transitions = {
        "Waiting": ["CheckedIn", "Cancelled"],
        "CheckedIn": ["InService", "Cancelled"],
        "InService": ["Completed", "Cancelled"],
        "Completed": [],
        "Cancelled": [],
    }

    if data.status not in valid_transitions.get(checkin.Status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition: {checkin.Status} -> {data.status}",
        )

    checkin.Status = data.status
    if data.staff_id:
        checkin.StaffID = data.staff_id
    if data.notes:
        checkin.Notes = data.notes

    now = datetime.now()
    if data.status == "InService":
        checkin.StartServiceTime = now
        if checkin.AppointmentID:
            from app.models.appointment import Appointment
            appt = (await db.execute(
                select(Appointment).where(Appointment.AppointmentID == checkin.AppointmentID)
            )).scalar_one_or_none()
            if appt:
                appt.Status = "InService"

    if data.status == "Completed":
        checkin.EndServiceTime = now
        customer = (await db.execute(select(Customer).where(Customer.CustomerID == checkin.CustomerID))).scalar_one_or_none()
        if customer:
            customer.TotalVisits += 1
            customer.LastVisitDate = now.date()
        if checkin.AppointmentID:
            from app.models.appointment import Appointment
            appt = (await db.execute(
                select(Appointment).where(Appointment.AppointmentID == checkin.AppointmentID)
            )).scalar_one_or_none()
            if appt:
                appt.Status = "Completed"

    await db.commit()
    await db.refresh(checkin)
    await _broadcast_checkin("updated", checkin, salon_id, db)
    return {"checkin_id": checkin_id, "status": data.status, "message": "Status updated"}


@router.get("/{checkin_id}")
async def get_checkin(
    checkin_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(CheckIn).where(CheckIn.CheckInID == checkin_id))
    checkin = result.scalar_one_or_none()
    if not checkin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found")

    customer = (await db.execute(select(Customer).where(Customer.CustomerID == checkin.CustomerID))).scalar_one_or_none()
    service = (await db.execute(select(Service).where(Service.ServiceID == checkin.ServiceID))).scalar_one_or_none()

    return {
        "checkin_id": checkin.CheckInID,
        "branch_id": checkin.BranchID,
        "customer_id": checkin.CustomerID,
        "customer_name": f"{customer.FirstName} {customer.LastName}" if customer else None,
        "customer_mobile": customer.Mobile if customer else None,
        "service_id": checkin.ServiceID,
        "service_name": service.ServiceName if service else None,
        "staff_id": checkin.StaffID,
        "queue_number": checkin.QueueNumber,
        "checkin_time": checkin.CheckInTime,
        "start_service_time": checkin.StartServiceTime,
        "end_service_time": checkin.EndServiceTime,
        "status": checkin.Status,
        "notes": checkin.Notes,
        "appointment_id": checkin.AppointmentID,
    }
