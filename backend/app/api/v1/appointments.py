from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date, time, datetime, timedelta
from typing import Optional, List

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ReceptionistOrAbove
from app.models.appointment import Appointment, AppointmentAddon, Waitlist
from app.models.service import Service
from app.models.staff import Staff, StaffSchedule
from app.models.user import User
from app.models.customer import Customer
from app.schemas.appointment import (
    AppointmentCreate, AppointmentUpdate, AppointmentReschedule,
    AppointmentCancel, AppointmentResponse, SlotAvailabilityRequest, WaitlistCreate,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("")
async def list_appointments(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    staff_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Appointment).where(Appointment.SalonID == salon_id)

    if branch_id:
        query = query.where(Appointment.BranchID == branch_id)
    if date_from:
        query = query.where(Appointment.AppointmentDate >= date_from)
    if date_to:
        query = query.where(Appointment.AppointmentDate <= date_to)
    if staff_id:
        query = query.where(Appointment.StaffID == staff_id)
    if customer_id:
        query = query.where(Appointment.CustomerID == customer_id)
    if status_filter:
        query = query.where(Appointment.Status == status_filter)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size).order_by(
        Appointment.AppointmentDate.desc(), Appointment.StartTime.asc()
    )
    result = await db.execute(query)
    appointments = result.scalars().all()

    return {
        "items": [await _format_appointment(a, db) for a in appointments],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    data: AppointmentCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    service = (await db.execute(
        select(Service).where(Service.ServiceID == data.service_id, Service.IsActive == True)
    )).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found or inactive")

    if data.customer_id is not None:
        customer = (await db.execute(
            select(Customer).where(Customer.CustomerID == data.customer_id)
        )).scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Customer not found (ID: {data.customer_id}). Please search and select a valid customer.")

    end_time = _add_minutes_to_time(data.start_time, service.Duration)

    conflict = await _check_conflict(db, data.branch_id, data.staff_id, data.appointment_date, data.start_time, end_time)
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This time slot is already booked. Please choose a different time.")

    appointment = Appointment(
        SalonID=salon_id,
        BranchID=data.branch_id,
        CustomerID=data.customer_id,
        StaffID=data.staff_id,
        ServiceID=data.service_id,
        AppointmentDate=data.appointment_date,
        StartTime=data.start_time,
        EndTime=end_time,
        Notes=data.notes,
        BookingSource=data.booking_source,
        ServiceAmount=service.Price,
        CreatedByUserID=current_user.UserID,
    )
    db.add(appointment)
    await db.flush()

    if data.addon_ids:
        from app.models.service import ServiceAddon
        for addon_id in data.addon_ids:
            addon = (await db.execute(
                select(ServiceAddon).where(ServiceAddon.AddonID == addon_id)
            )).scalar_one_or_none()
            if addon:
                db.add(AppointmentAddon(AppointmentID=appointment.AppointmentID, AddonID=addon_id, Price=addon.Price))

    await db.commit()
    await db.refresh(appointment)
    await _broadcast_appointment("created", appointment, db)
    return await _format_appointment(appointment, db)


@router.get("/calendar")
async def get_calendar_appointments(
    salon_id: int = Depends(get_salon_id),
    branch_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    staff_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Appointment).where(
        Appointment.SalonID == salon_id,
        Appointment.BranchID == branch_id,
        Appointment.AppointmentDate >= start_date,
        Appointment.AppointmentDate <= end_date,
        Appointment.Status.notin_(["Cancelled"]),
    )
    if staff_id:
        query = query.where(Appointment.StaffID == staff_id)

    result = await db.execute(query)
    appointments = result.scalars().all()

    # Bulk-load customers and services to avoid N+1 queries
    appt_ids = list({a.CustomerID for a in appointments if a.CustomerID})
    svc_ids = list({a.ServiceID for a in appointments if a.ServiceID})

    customers_map: dict = {}
    if appt_ids:
        cust_rows = (await db.execute(select(Customer).where(Customer.CustomerID.in_(appt_ids)))).scalars().all()
        customers_map = {c.CustomerID: c for c in cust_rows}

    services_map: dict = {}
    if svc_ids:
        svc_rows = (await db.execute(select(Service).where(Service.ServiceID.in_(svc_ids)))).scalars().all()
        services_map = {s.ServiceID: s for s in svc_rows}

    events = []
    for a in appointments:
        cust = customers_map.get(a.CustomerID)
        svc = services_map.get(a.ServiceID)
        if cust:
            customer_name = f"{cust.FirstName} {cust.LastName}"
        else:
            customer_name = "Walk-in"
        service_name = svc.ServiceName if svc else f"Service #{a.ServiceID}"
        title = f"{customer_name} – {service_name}"
        events.append({
            "id": a.AppointmentID,
            "title": title,
            "start": f"{a.AppointmentDate}T{a.StartTime}",
            "end": f"{a.AppointmentDate}T{a.EndTime}",
            "status": a.Status,
            "customer_id": a.CustomerID,
            "customer_name": customer_name,
            "staff_id": a.StaffID,
            "service_id": a.ServiceID,
            "service_name": service_name,
            "notes": a.Notes,
            "color": _status_color(a.Status),
        })
    return events


@router.get("/slots")
async def get_available_slots(
    branch_id: int = Query(...),
    service_id: int = Query(...),
    date: date = Query(...),
    staff_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    service = (await db.execute(
        select(Service).where(Service.ServiceID == service_id)
    )).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    from app.models.salon import Branch
    branch = (await db.execute(select(Branch).where(Branch.BranchID == branch_id))).scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    day_of_week = date.weekday()
    slots = []
    open_time = branch.OpeningTime or time(9, 0)
    close_time = branch.ClosingTime or time(20, 0)
    slot_duration = branch.SlotDuration or 30

    current = datetime.combine(date, open_time)
    end_boundary = datetime.combine(date, close_time)

    existing = (await db.execute(
        select(Appointment).where(
            Appointment.BranchID == branch_id,
            Appointment.AppointmentDate == date,
            Appointment.Status.notin_(["Cancelled", "NoShow"]),
            Appointment.StaffID == staff_id if staff_id else True,
        )
    )).scalars().all()

    booked_slots = {(str(a.StartTime), a.StaffID) for a in existing}

    while current + timedelta(minutes=service.Duration) <= end_boundary:
        slot_time = current.time()
        is_booked = (str(slot_time), staff_id) in booked_slots if staff_id else False
        slots.append({
            "start_time": str(slot_time),
            "end_time": str((current + timedelta(minutes=service.Duration)).time()),
            "is_available": not is_booked,
        })
        current += timedelta(minutes=slot_duration)

    return slots


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.AppointmentID == appointment_id,
            Appointment.SalonID == salon_id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return await _format_appointment(appt, db)


@router.put("/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: int,
    status_update: AppointmentUpdate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Appointment).where(Appointment.AppointmentID == appointment_id, Appointment.SalonID == salon_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if status_update.status:
        appt.Status = status_update.status
    if status_update.staff_id:
        appt.StaffID = status_update.staff_id
    if status_update.notes:
        appt.Notes = status_update.notes

    await db.commit()
    await _broadcast_appointment("updated", appt, db)
    return {"message": "Appointment updated", "status": appt.Status}


@router.post("/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: int,
    data: AppointmentCancel,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Appointment).where(Appointment.AppointmentID == appointment_id, Appointment.SalonID == salon_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.Status in ["Completed", "Cancelled"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot cancel {appt.Status} appointment")

    appt.Status = "Cancelled"
    appt.CancellationReason = data.cancellation_reason
    await db.commit()
    await _broadcast_appointment("cancelled", appt, db)
    return {"message": "Appointment cancelled"}


@router.post("/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: int,
    data: AppointmentReschedule,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Appointment).where(Appointment.AppointmentID == appointment_id, Appointment.SalonID == salon_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    service = (await db.execute(select(Service).where(Service.ServiceID == appt.ServiceID))).scalar_one()
    end_time = _add_minutes_to_time(data.start_time, service.Duration)

    appt.AppointmentDate = data.appointment_date
    appt.StartTime = data.start_time
    appt.EndTime = end_time
    if data.staff_id:
        appt.StaffID = data.staff_id
    appt.Status = "Scheduled"
    appt.RescheduledFromID = appointment_id

    await db.commit()
    await _broadcast_appointment("updated", appt, db)
    return {"message": "Appointment rescheduled"}


async def _broadcast_appointment(event_type: str, appt: Appointment, db: AsyncSession):
    """
    Write an appointment event to the outbox for durable delivery.
    The outbox relay (every 200ms) picks it up → publishes to Redis →
    the WS backplane fans out to every connected client across all workers.
    Also does an in-process direct broadcast so clients on THIS worker
    receive the event instantly (< 5ms) without waiting for the relay cycle.
    """
    try:
        from app.core.ws_manager import appointment_sync
        from app.models.customer import Customer
        from app.models.service import Service as ServiceModel
        from app.models.outbox import OutboxEvent
        from app.core.database import AsyncSessionLocal

        customer_name = "Walk-in"
        service_name = f"Service #{appt.ServiceID}"

        if appt.CustomerID:
            cust = (await db.execute(
                select(Customer).where(Customer.CustomerID == appt.CustomerID)
            )).scalar_one_or_none()
            if cust:
                customer_name = f"{cust.FirstName} {cust.LastName}"

        if appt.ServiceID:
            svc = (await db.execute(
                select(ServiceModel).where(ServiceModel.ServiceID == appt.ServiceID)
            )).scalar_one_or_none()
            if svc:
                service_name = svc.ServiceName

        payload = {
            "type": f"appointment.{event_type}",
            "appointment": {
                "id": appt.AppointmentID,
                "version": int(appt.UpdatedAt.timestamp()) if appt.UpdatedAt else 0,
                "title": f"{customer_name} – {service_name}",
                "start": f"{appt.AppointmentDate}T{appt.StartTime}",
                "end": f"{appt.AppointmentDate}T{appt.EndTime}",
                "status": appt.Status,
                "branch_id": appt.BranchID,
                "salon_id": appt.SalonID,
                "customer_id": appt.CustomerID,
                "customer_name": customer_name,
                "staff_id": appt.StaffID,
                "service_id": appt.ServiceID,
                "service_name": service_name,
                "notes": appt.Notes,
                "color": _status_color(appt.Status),
            },
        }

        # Write to outbox (separate session — called after main commit)
        async with AsyncSessionLocal() as session:
            session.add(OutboxEvent(
                salon_id=appt.SalonID,
                event_type=f"appointment.{event_type}",
                payload=payload,
            ))
            await session.commit()

        # Direct broadcast for instant same-worker delivery
        await appointment_sync.broadcast(appt.SalonID, payload)
    except Exception:
        pass  # never let broadcast failure break the API response


def _add_minutes_to_time(t: time, minutes: int) -> time:
    dt = datetime.combine(date.today(), t) + timedelta(minutes=minutes)
    return dt.time()


def _status_color(status: str) -> str:
    colors = {
        "Scheduled": "#2196F3",
        "Confirmed": "#4CAF50",
        "CheckedIn": "#FF9800",
        "InService": "#9C27B0",
        "Completed": "#607D8B",
        "Cancelled": "#F44336",
        "NoShow": "#795548",
    }
    return colors.get(status, "#9E9E9E")


async def _check_conflict(db, branch_id, staff_id, appt_date, start_time, end_time) -> bool:
    if not staff_id:
        return False
    result = await db.execute(
        select(Appointment).where(
            Appointment.BranchID == branch_id,
            Appointment.StaffID == staff_id,
            Appointment.AppointmentDate == appt_date,
            Appointment.Status.notin_(["Cancelled", "NoShow"]),
            Appointment.StartTime < end_time,
            Appointment.EndTime > start_time,
        )
    )
    return result.scalar_one_or_none() is not None


async def _format_appointment(appt: Appointment, db: AsyncSession) -> dict:
    from app.models.customer import Customer
    from app.models.service import Service as ServiceModel

    customer = None
    service = None
    staff_user = None

    if appt.CustomerID:
        customer = (await db.execute(select(Customer).where(Customer.CustomerID == appt.CustomerID))).scalar_one_or_none()
    if appt.ServiceID:
        service = (await db.execute(select(ServiceModel).where(ServiceModel.ServiceID == appt.ServiceID))).scalar_one_or_none()
    if appt.StaffID:
        staff = (await db.execute(select(Staff).where(Staff.StaffID == appt.StaffID))).scalar_one_or_none()
        if staff:
            staff_user = (await db.execute(select(User).where(User.UserID == staff.UserID))).scalar_one_or_none()

    return {
        "appointment_id": appt.AppointmentID,
        "salon_id": appt.SalonID,
        "branch_id": appt.BranchID,
        "customer_id": appt.CustomerID,
        "customer_name": f"{customer.FirstName} {customer.LastName}" if customer else None,
        "customer_mobile": customer.Mobile if customer else None,
        "staff_id": appt.StaffID,
        "staff_name": f"{staff_user.FirstName} {staff_user.LastName}" if staff_user else None,
        "service_id": appt.ServiceID,
        "service_name": service.ServiceName if service else None,
        "service_duration": service.Duration if service else None,
        "appointment_date": appt.AppointmentDate,
        "start_time": appt.StartTime,
        "end_time": appt.EndTime,
        "status": appt.Status,
        "notes": appt.Notes,
        "booking_source": appt.BookingSource,
        "service_amount": float(appt.ServiceAmount) if appt.ServiceAmount else None,
        "created_at": appt.CreatedAt,
    }
