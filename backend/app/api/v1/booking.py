"""Public booking portal — no authentication required."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import date, time, datetime, timedelta
from pydantic import BaseModel, EmailStr

from app.core.database import get_async_db
from app.models.salon import Salon, Branch
from app.models.service import Service, ServiceCategory, StaffService
from app.models.staff import Staff, StaffSchedule
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.user import User

router = APIRouter(prefix="/booking", tags=["Public Booking"])


@router.get("/salon/{salon_id}/info")
async def get_salon_info(
    salon_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    salon = (await db.execute(select(Salon).where(Salon.SalonID == salon_id, Salon.IsActive == True))).scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    branches = (await db.execute(
        select(Branch).where(Branch.SalonID == salon_id, Branch.IsActive == True)
    )).scalars().all()

    return {
        "salon_id": salon.SalonID,
        "salon_name": salon.SalonName,
        "logo_url": salon.LogoURL,
        "currency": salon.Currency,
        "branches": [
            {
                "branch_id": b.BranchID,
                "branch_name": b.BranchName,
                "address": b.Address,
                "city": b.City,
                "phone": b.Phone,
                "open_time": str(b.OpeningTime) if b.OpeningTime else "09:00",
                "close_time": str(b.ClosingTime) if b.ClosingTime else "20:00",
            }
            for b in branches
        ],
    }


@router.get("/salon/{salon_id}/services")
async def get_public_services(
    salon_id: int,
    category_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    categories = (await db.execute(
        select(ServiceCategory).where(ServiceCategory.SalonID == salon_id, ServiceCategory.IsActive == True)
    )).scalars().all()

    svc_query = select(Service).where(Service.SalonID == salon_id, Service.IsActive == True)
    if category_id:
        svc_query = svc_query.where(Service.CategoryID == category_id)
    services = (await db.execute(svc_query)).scalars().all()

    cat_map = {c.CategoryID: c.CategoryName for c in categories}
    return [
        {
            "service_id": s.ServiceID,
            "service_name": s.ServiceName,
            "category_id": s.CategoryID,
            "category_name": cat_map.get(s.CategoryID, ""),
            "duration_minutes": s.Duration,
            "price": float(s.Price),
            "description": s.Description,
            "gender_type": s.GenderType,
        }
        for s in services
    ]


@router.get("/salon/{salon_id}/staff")
async def get_public_staff(
    salon_id: int,
    service_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    query = select(Staff, User).join(User, Staff.UserID == User.UserID).where(
        Staff.SalonID == salon_id, Staff.IsActive == True
    )
    if branch_id:
        query = query.where(Staff.BranchID == branch_id)
    rows = (await db.execute(query)).all()

    result = []
    for staff, user in rows:
        if service_id:
            ss = (await db.execute(
                select(StaffService).where(StaffService.StaffID == staff.StaffID, StaffService.ServiceID == service_id)
            )).scalar_one_or_none()
            if not ss:
                continue
        result.append({
            "staff_id": staff.StaffID,
            "name": f"{user.FirstName} {user.LastName}",
            "job_title": staff.JobTitle,
            "rating": float(staff.AverageRating),
        })
    return result


@router.get("/salon/{salon_id}/slots")
async def get_available_slots(
    salon_id: int,
    branch_id: int,
    service_id: int,
    booking_date: date,
    staff_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_async_db),
):
    service = (await db.execute(select(Service).where(Service.ServiceID == service_id))).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    duration = service.Duration
    branch = (await db.execute(select(Branch).where(Branch.BranchID == branch_id))).scalar_one_or_none()

    open_time = branch.OpeningTime if branch and branch.OpeningTime else time(9, 0)
    close_time = branch.ClosingTime if branch and branch.ClosingTime else time(20, 0)

    slot_start = datetime.combine(booking_date, open_time)
    slot_end = datetime.combine(booking_date, close_time)

    # Get existing appointments on this date
    appts_query = select(Appointment).where(
        Appointment.BranchID == branch_id,
        Appointment.AppointmentDate == booking_date,
        Appointment.Status.notin_(["Cancelled", "NoShow"]),
    )
    if staff_id:
        appts_query = appts_query.where(Appointment.StaffID == staff_id)
    existing = (await db.execute(appts_query)).scalars().all()

    booked_ranges = []
    for a in existing:
        if a.StartTime:
            s = datetime.combine(booking_date, a.StartTime)
            e = s + timedelta(minutes=duration)
            booked_ranges.append((s, e))

    slots = []
    current = slot_start
    while current + timedelta(minutes=duration) <= slot_end:
        slot_end_time = current + timedelta(minutes=duration)
        conflict = any(s < slot_end_time and e > current for s, e in booked_ranges)
        if not conflict:
            slots.append(current.strftime("%H:%M"))
        current += timedelta(minutes=30)

    return {"date": str(booking_date), "slots": slots, "duration_minutes": duration}


class BookingRequest(BaseModel):
    salon_id: int
    branch_id: int
    service_id: int
    staff_id: Optional[int] = None
    booking_date: date
    start_time: str  # HH:MM
    first_name: str
    last_name: str
    mobile: str
    email: Optional[str] = None
    notes: Optional[str] = None


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
async def create_public_booking(
    data: BookingRequest,
    db: AsyncSession = Depends(get_async_db),
):
    salon = (await db.execute(select(Salon).where(Salon.SalonID == data.salon_id))).scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    service = (await db.execute(select(Service).where(Service.ServiceID == data.service_id))).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Find or create customer
    customer = (await db.execute(
        select(Customer).where(Customer.Mobile == data.mobile, Customer.SalonID == data.salon_id)
    )).scalar_one_or_none()

    if not customer:
        customer = Customer(
            SalonID=data.salon_id,
            FirstName=data.first_name,
            LastName=data.last_name,
            Mobile=data.mobile,
            Email=data.email,
        )
        db.add(customer)
        await db.flush()

    h, m = map(int, data.start_time.split(":"))
    start = time(h, m)

    from datetime import timedelta as td
    h2, m2 = map(int, data.start_time.split(":"))
    end = (datetime.combine(data.booking_date, time(h2, m2)) + td(minutes=service.Duration)).time()

    appointment = Appointment(
        SalonID=data.salon_id,
        BranchID=data.branch_id,
        CustomerID=customer.CustomerID,
        StaffID=data.staff_id,
        ServiceID=data.service_id,
        AppointmentDate=data.booking_date,
        StartTime=start,
        EndTime=end,
        ServiceAmount=service.Price,
        Status="Scheduled",
        Notes=data.notes,
        BookingSource="Online",
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    return {
        "appointment_id": appointment.AppointmentID,
        "confirmation_number": f"BK-{appointment.AppointmentID:06d}",
        "customer_name": f"{customer.FirstName} {customer.LastName}",
        "service_name": service.ServiceName,
        "date": str(data.booking_date),
        "time": data.start_time,
        "duration_minutes": service.Duration,
    }
