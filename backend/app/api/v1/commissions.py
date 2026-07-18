from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import date

from app.core.database import get_async_db
from app.core.dependencies import get_salon_id, ManagerOrAbove
from app.models.staff import Staff, Commission
from app.models.user import User

router = APIRouter(prefix="/commissions", tags=["Commissions"])


@router.get("")
async def list_commissions(
    salon_id: int = Depends(get_salon_id),
    staff_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = (
        select(Commission, Staff)
        .join(Staff, Commission.StaffID == Staff.StaffID)
        .where(Staff.SalonID == salon_id)
    )
    if staff_id:
        query = query.where(Commission.StaffID == staff_id)
    if status:
        query = query.where(Commission.Status == status)
    if date_from:
        query = query.where(func.date(Commission.CreatedAt) >= date_from)
    if date_to:
        query = query.where(func.date(Commission.CreatedAt) <= date_to)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Commission.CreatedAt.desc())
    rows = (await db.execute(query)).all()

    from app.models.user import User as UserModel
    items = []
    for commission, staff in rows:
        user = (await db.execute(select(UserModel).where(UserModel.UserID == staff.UserID))).scalar_one_or_none()
        items.append({
            "commission_id": commission.CommissionID,
            "staff_id": commission.StaffID,
            "staff_name": f"{user.FirstName} {user.LastName}" if user else "Unknown",
            "invoice_id": commission.InvoiceID,
            "base_amount": float(commission.BaseAmount),
            "commission_percent": float(commission.CommissionPercent),
            "amount": float(commission.Amount),
            "status": commission.Status,
            "created_at": commission.CreatedAt,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/summary")
async def commission_summary(
    salon_id: int = Depends(get_salon_id),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = (
        select(
            Staff.StaffID,
            func.sum(Commission.Amount).label("total_commission"),
            func.sum(Commission.BaseAmount).label("total_revenue"),
            func.count(Commission.CommissionID).label("service_count"),
        )
        .join(Commission, Commission.StaffID == Staff.StaffID)
        .where(Staff.SalonID == salon_id)
        .group_by(Staff.StaffID)
    )
    if date_from:
        query = query.where(func.date(Commission.CreatedAt) >= date_from)
    if date_to:
        query = query.where(func.date(Commission.CreatedAt) <= date_to)

    rows = (await db.execute(query)).all()

    from app.models.user import User as UserModel
    summary = []
    for row in rows:
        staff = (await db.execute(select(Staff).where(Staff.StaffID == row.StaffID))).scalar_one_or_none()
        user = (await db.execute(select(UserModel).where(UserModel.UserID == staff.UserID))).scalar_one_or_none() if staff else None
        summary.append({
            "staff_id": row.StaffID,
            "staff_name": f"{user.FirstName} {user.LastName}" if user else "Unknown",
            "job_title": staff.JobTitle if staff else None,
            "commission_percent": float(staff.CommissionPercent) if staff else 0,
            "total_commission": float(row.total_commission or 0),
            "total_revenue": float(row.total_revenue or 0),
            "service_count": row.service_count,
        })

    return {"summary": summary}
