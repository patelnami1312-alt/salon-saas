from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ManagerOrAbove
from app.models.staff import Staff, Payroll, Commission, StaffAttendance
from app.models.user import User

router = APIRouter(prefix="/payroll", tags=["payroll"])
_manager = ManagerOrAbove()


def _payroll_dict(p: Payroll, staff: Optional[Staff] = None) -> dict:
    s = staff or p.staff
    return {
        "payroll_id": p.PayrollID,
        "staff_id": p.StaffID,
        "staff_name": s.user.full_name if s and s.user else None,
        "job_title": s.JobTitle if s else None,
        "pay_period_start": p.PayPeriodStart.isoformat(),
        "pay_period_end": p.PayPeriodEnd.isoformat(),
        "base_salary": float(p.BaseSalary),
        "total_commission": float(p.TotalCommission),
        "bonus": float(p.Bonus),
        "total_deductions": float(p.TotalDeductions),
        "net_pay": float(p.NetPay),
        "working_days": p.WorkingDays,
        "present_days": p.PresentDays,
        "status": p.Status,
        "notes": p.Notes,
        "processed_at": p.ProcessedAt.isoformat() if p.ProcessedAt else None,
        "created_at": p.CreatedAt.isoformat() if p.CreatedAt else None,
    }


@router.get("")
async def list_payroll(
    pay_period_start: Optional[date] = Query(None),
    pay_period_end: Optional[date] = Query(None),
    staff_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    q = (
        select(Payroll)
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .options(selectinload(Payroll.staff).selectinload(Staff.user))
        .where(Staff.SalonID == salon_id)
    )
    if pay_period_start:
        q = q.where(Payroll.PayPeriodStart >= pay_period_start)
    if pay_period_end:
        q = q.where(Payroll.PayPeriodEnd <= pay_period_end)
    if staff_id:
        q = q.where(Payroll.StaffID == staff_id)
    if status:
        q = q.where(Payroll.Status == status)

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size).order_by(Payroll.PayPeriodStart.desc())
    result = await db.execute(q)
    records = result.scalars().all()

    # summary totals
    total_net_r = await db.execute(
        select(func.sum(Payroll.NetPay))
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .where(Staff.SalonID == salon_id)
        .where(Payroll.Status.in_(["Approved", "Paid"]))
    )
    total_net = float(total_net_r.scalar() or 0)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_net_paid": total_net,
        "items": [_payroll_dict(p) for p in records],
    }


@router.get("/{payroll_id}")
async def get_payroll(
    payroll_id: int,
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
):
    result = await db.execute(
        select(Payroll)
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .options(selectinload(Payroll.staff).selectinload(Staff.user))
        .where(Payroll.PayrollID == payroll_id, Staff.SalonID == salon_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    return _payroll_dict(p)


@router.post("/generate", status_code=201)
async def generate_payroll(
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    """Generate payroll for all staff (or specific staff) for a pay period."""
    period_start: date = date.fromisoformat(body["pay_period_start"])
    period_end: date = date.fromisoformat(body["pay_period_end"])

    # Get staff to process
    staff_q = select(Staff).options(selectinload(Staff.user)).where(
        Staff.SalonID == salon_id, Staff.IsActive == True
    )
    if body.get("staff_ids"):
        staff_q = staff_q.where(Staff.StaffID.in_(body["staff_ids"]))
    staff_r = await db.execute(staff_q)
    staff_list = staff_r.scalars().all()

    if not staff_list:
        raise HTTPException(status_code=404, detail="No active staff found")

    created = []
    for staff in staff_list:
        # Check if payroll already exists for this period
        existing_r = await db.execute(
            select(Payroll).where(
                Payroll.StaffID == staff.StaffID,
                Payroll.PayPeriodStart == period_start,
                Payroll.PayPeriodEnd == period_end,
            )
        )
        if existing_r.scalar_one_or_none():
            continue

        # Sum pending commissions in this period
        comm_r = await db.execute(
            select(func.sum(Commission.Amount))
            .where(
                Commission.StaffID == staff.StaffID,
                Commission.Status == "Pending",
                Commission.CreatedAt >= datetime.combine(period_start, datetime.min.time()),
                Commission.CreatedAt <= datetime.combine(period_end, datetime.max.time()),
            )
        )
        total_commission = float(comm_r.scalar() or 0)

        # Count attendance
        att_r = await db.execute(
            select(func.count(StaffAttendance.AttendanceID))
            .where(
                StaffAttendance.StaffID == staff.StaffID,
                StaffAttendance.AttendanceDate >= period_start,
                StaffAttendance.AttendanceDate <= period_end,
                StaffAttendance.Status == "Present",
            )
        )
        present_days = att_r.scalar() or 0

        # Working days in period (period_end - period_start + 1 as calendar days)
        working_days = (period_end - period_start).days + 1

        base_salary = float(staff.Salary or 0)
        bonus = float(body.get("bonus_per_staff", {}).get(str(staff.StaffID), 0))
        deductions = float(body.get("deductions_per_staff", {}).get(str(staff.StaffID), 0))
        net_pay = base_salary + total_commission + bonus - deductions

        payroll = Payroll(
            StaffID=staff.StaffID,
            PayPeriodStart=period_start,
            PayPeriodEnd=period_end,
            BaseSalary=Decimal(str(base_salary)),
            TotalCommission=Decimal(str(total_commission)),
            Bonus=Decimal(str(bonus)),
            TotalDeductions=Decimal(str(deductions)),
            NetPay=Decimal(str(max(net_pay, 0))),
            WorkingDays=working_days,
            PresentDays=present_days,
            Status="Pending",
            ProcessedByUserID=current_user.UserID,
        )
        db.add(payroll)
        created.append(staff.StaffID)

    await db.commit()
    return {"message": f"Payroll generated for {len(created)} staff members", "staff_ids": created}


@router.put("/{payroll_id}")
async def update_payroll(
    payroll_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    result = await db.execute(
        select(Payroll)
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .options(selectinload(Payroll.staff).selectinload(Staff.user))
        .where(Payroll.PayrollID == payroll_id, Staff.SalonID == salon_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    for field, col in [
        ("bonus", "Bonus"), ("total_deductions", "TotalDeductions"),
        ("notes", "Notes"), ("status", "Status"),
    ]:
        if field in body:
            val = Decimal(str(body[field])) if field in ("bonus", "total_deductions") else body[field]
            setattr(p, col, val)

    # Recalculate net pay if financials changed
    if any(f in body for f in ("bonus", "total_deductions")):
        p.NetPay = Decimal(str(max(
            float(p.BaseSalary) + float(p.TotalCommission) + float(p.Bonus) - float(p.TotalDeductions), 0
        )))

    if body.get("status") == "Approved":
        p.ProcessedAt = datetime.utcnow()
        p.ProcessedByUserID = current_user.UserID

    await db.commit()
    await db.refresh(p)
    return _payroll_dict(p)


@router.post("/{payroll_id}/approve")
async def approve_payroll(
    payroll_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    result = await db.execute(
        select(Payroll)
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .where(Payroll.PayrollID == payroll_id, Staff.SalonID == salon_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    p.Status = "Approved"
    p.ProcessedAt = datetime.utcnow()
    p.ProcessedByUserID = current_user.UserID
    await db.commit()
    return {"message": "Payroll approved"}


@router.post("/{payroll_id}/mark-paid")
async def mark_payroll_paid(
    payroll_id: int,
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    result = await db.execute(
        select(Payroll)
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .where(Payroll.PayrollID == payroll_id, Staff.SalonID == salon_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    p.Status = "Paid"
    await db.commit()
    return {"message": "Payroll marked as paid"}


@router.get("/summary/period")
async def payroll_summary(
    pay_period_start: date = Query(...),
    pay_period_end: date = Query(...),
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    q = (
        select(
            func.sum(Payroll.NetPay).label("total_net"),
            func.sum(Payroll.BaseSalary).label("total_salary"),
            func.sum(Payroll.TotalCommission).label("total_commission"),
            func.sum(Payroll.Bonus).label("total_bonus"),
            func.sum(Payroll.TotalDeductions).label("total_deductions"),
            func.count(Payroll.PayrollID).label("staff_count"),
        )
        .join(Staff, Payroll.StaffID == Staff.StaffID)
        .where(
            Staff.SalonID == salon_id,
            Payroll.PayPeriodStart >= pay_period_start,
            Payroll.PayPeriodEnd <= pay_period_end,
        )
    )
    result = await db.execute(q)
    row = result.one()
    return {
        "total_net_pay": float(row.total_net or 0),
        "total_base_salary": float(row.total_salary or 0),
        "total_commission": float(row.total_commission or 0),
        "total_bonus": float(row.total_bonus or 0),
        "total_deductions": float(row.total_deductions or 0),
        "staff_count": row.staff_count or 0,
    }
