from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from datetime import date, datetime, timedelta
from typing import Optional

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ManagerOrAbove
from app.models.billing import Invoice, InvoiceItem, Payment
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.staff import Staff, StaffAttendance
from app.models.checkin import CheckIn
from app.models.user import User
from app.models.inventory import Inventory, Product

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/dashboard")
async def get_dashboard(
    branch_id: Optional[int] = Query(None),
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    inv_query_base = select(func.sum(Invoice.TotalAmount)).where(Invoice.SalonID == salon_id, Invoice.Status == "Paid")
    appt_query_base = select(func.count()).where(Appointment.SalonID == salon_id)
    customer_query = select(func.count()).where(Customer.SalonID == salon_id, Customer.IsActive == True)

    if branch_id:
        inv_query_base = inv_query_base.where(Invoice.BranchID == branch_id)
        appt_query_base = appt_query_base.select_from(Appointment).where(Appointment.BranchID == branch_id)

    today_revenue = (await db.execute(
        inv_query_base.where(func.cast(Invoice.CreatedAt, Date) == today)
    )).scalar() or 0

    weekly_revenue = (await db.execute(
        inv_query_base.where(func.cast(Invoice.CreatedAt, Date) >= week_start)
    )).scalar() or 0

    monthly_revenue = (await db.execute(
        inv_query_base.where(func.cast(Invoice.CreatedAt, Date) >= month_start)
    )).scalar() or 0

    today_appointments = (await db.execute(
        appt_query_base.where(Appointment.AppointmentDate == today)
    )).scalar() or 0

    pending_appointments = (await db.execute(
        appt_query_base.where(
            Appointment.AppointmentDate == today,
            Appointment.Status.in_(["Scheduled", "Confirmed"])
        )
    )).scalar() or 0

    total_customers = (await db.execute(customer_query)).scalar() or 0

    new_customers_today = (await db.execute(
        select(func.count()).where(
            Customer.SalonID == salon_id,
            func.cast(Customer.CreatedAt, Date) == today,
        )
    )).scalar() or 0

    in_queue = (await db.execute(
        select(func.count()).where(
            CheckIn.Status.in_(["Waiting", "CheckedIn", "InService"]),
            CheckIn.BranchID == branch_id if branch_id else True,
        )
    )).scalar() or 0

    return {
        "today_revenue": float(today_revenue),
        "weekly_revenue": float(weekly_revenue),
        "monthly_revenue": float(monthly_revenue),
        "today_appointments": today_appointments,
        "pending_appointments": pending_appointments,
        "total_customers": total_customers,
        "new_customers_today": new_customers_today,
        "in_queue": in_queue,
        "date": str(today),
    }


@router.get("/revenue")
async def get_revenue_report(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    date_from: date = Query(default=(date.today() - timedelta(days=30))),
    date_to: date = Query(default=date.today()),
    group_by: str = Query(default="day", enum=["day", "week", "month"]),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = select(
        func.cast(Invoice.CreatedAt, Date).label("period"),
        func.sum(Invoice.TotalAmount).label("revenue"),
        func.sum(Invoice.TaxAmount).label("tax"),
        func.sum(Invoice.DiscountAmount).label("discount"),
        func.count(Invoice.InvoiceID).label("invoice_count"),
    ).where(
        Invoice.SalonID == salon_id,
        Invoice.Status == "Paid",
        func.cast(Invoice.CreatedAt, Date) >= date_from,
        func.cast(Invoice.CreatedAt, Date) <= date_to,
    )

    if branch_id:
        query = query.where(Invoice.BranchID == branch_id)

    query = query.group_by(func.cast(Invoice.CreatedAt, Date)).order_by(func.cast(Invoice.CreatedAt, Date))
    result = await db.execute(query)
    rows = result.all()

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "data": [
            {
                "period": str(r.period),
                "revenue": float(r.revenue or 0),
                "tax": float(r.tax or 0),
                "discount": float(r.discount or 0),
                "invoice_count": r.invoice_count,
            }
            for r in rows
        ],
        "total_revenue": float(sum(r.revenue or 0 for r in rows)),
        "total_invoices": sum(r.invoice_count for r in rows),
    }


@router.get("/staff-performance")
async def get_staff_performance(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    date_from: date = Query(default=(date.today() - timedelta(days=30))),
    date_to: date = Query(default=date.today()),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = select(
        Staff.StaffID,
        User.FirstName,
        User.LastName,
        func.count(Appointment.AppointmentID).label("total_appointments"),
        func.sum(Invoice.TotalAmount).label("total_revenue"),
        Staff.AverageRating,
    ).join(User, User.UserID == Staff.UserID)\
     .outerjoin(Appointment, Appointment.StaffID == Staff.StaffID)\
     .outerjoin(Invoice, Invoice.AppointmentID == Appointment.AppointmentID)\
     .where(Staff.SalonID == salon_id)

    if branch_id:
        query = query.where(Staff.BranchID == branch_id)
    if date_from:
        query = query.where(Appointment.AppointmentDate >= date_from)
    if date_to:
        query = query.where(Appointment.AppointmentDate <= date_to)

    query = query.group_by(Staff.StaffID, User.FirstName, User.LastName, Staff.AverageRating)
    result = await db.execute(query)
    rows = result.all()

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "staff": [
            {
                "staff_id": r.StaffID,
                "name": f"{r.FirstName} {r.LastName}",
                "total_appointments": r.total_appointments or 0,
                "total_revenue": float(r.total_revenue or 0),
                "average_rating": float(r.AverageRating or 0),
            }
            for r in rows
        ],
    }


@router.get("/services")
async def get_service_report(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    date_from: date = Query(default=(date.today() - timedelta(days=30))),
    date_to: date = Query(default=date.today()),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = select(
        InvoiceItem.ItemRefID,
        InvoiceItem.ItemName,
        func.count(InvoiceItem.ItemID).label("count"),
        func.sum(InvoiceItem.TotalPrice).label("revenue"),
    ).join(Invoice, Invoice.InvoiceID == InvoiceItem.InvoiceID)\
     .where(
        Invoice.SalonID == salon_id,
        Invoice.Status == "Paid",
        InvoiceItem.ItemType == "Service",
        func.cast(Invoice.CreatedAt, Date) >= date_from,
        func.cast(Invoice.CreatedAt, Date) <= date_to,
     )

    if branch_id:
        query = query.where(Invoice.BranchID == branch_id)

    query = query.group_by(InvoiceItem.ItemRefID, InvoiceItem.ItemName).order_by(func.sum(InvoiceItem.TotalPrice).desc())
    result = await db.execute(query)
    rows = result.all()

    return {
        "services": [
            {"service_id": r.ItemRefID, "service_name": r.ItemName, "count": r.count, "revenue": float(r.revenue or 0)}
            for r in rows
        ]
    }


@router.get("/customers")
async def get_customer_retention_report(
    salon_id: int = Depends(get_salon_id),
    date_from: date = Query(default=(date.today() - timedelta(days=90))),
    date_to: date = Query(default=date.today()),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    total = (await db.execute(
        select(func.count()).where(Customer.SalonID == salon_id, Customer.IsActive == True)
    )).scalar() or 0

    new_customers = (await db.execute(
        select(func.count()).where(
            Customer.SalonID == salon_id,
            func.cast(Customer.CreatedAt, Date) >= date_from,
            func.cast(Customer.CreatedAt, Date) <= date_to,
        )
    )).scalar() or 0

    repeat_customers = (await db.execute(
        select(func.count()).where(Customer.SalonID == salon_id, Customer.TotalVisits > 1)
    )).scalar() or 0

    return {
        "total_customers": total,
        "new_customers_period": new_customers,
        "repeat_customers": repeat_customers,
        "retention_rate": round(repeat_customers / total * 100, 2) if total > 0 else 0,
        "date_from": str(date_from),
        "date_to": str(date_to),
    }


@router.get("/inventory")
async def get_inventory_report(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = select(
        Product.ProductName,
        Product.SKU,
        Inventory.CurrentStock,
        Inventory.MinStockLevel,
        Product.CostPrice,
        Product.SalePrice,
    ).join(Product, Product.ProductID == Inventory.ProductID)\
     .where(Product.SalonID == salon_id, Product.IsActive == True)

    if branch_id:
        query = query.where(Inventory.BranchID == branch_id)

    result = await db.execute(query)
    rows = result.all()

    low_stock = [r for r in rows if float(r.CurrentStock) <= float(r.MinStockLevel)]

    return {
        "total_products": len(rows),
        "low_stock_count": len(low_stock),
        "products": [
            {
                "product_name": r.ProductName,
                "sku": r.SKU,
                "current_stock": float(r.CurrentStock),
                "min_stock": float(r.MinStockLevel),
                "is_low_stock": float(r.CurrentStock) <= float(r.MinStockLevel),
                "stock_value": float(r.CurrentStock) * float(r.CostPrice),
            }
            for r in rows
        ],
        "low_stock_items": [
            {"product_name": r.ProductName, "current_stock": float(r.CurrentStock), "min_stock": float(r.MinStockLevel)}
            for r in low_stock
        ],
    }
