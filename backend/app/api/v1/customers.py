from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
import math

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ReceptionistOrAbove
from app.core.security import generate_referral_code
from app.models.customer import Customer, MembershipPlan, CustomerMembership, WalletTransaction, LoyaltyTransaction
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse,
    MembershipPlanCreate, MembershipPlanResponse, AssignMembershipRequest,
    AddWalletRequest, ReviewCreate,
)
from datetime import date

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    salon_id: int = Depends(get_salon_id),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    query = select(Customer).where(Customer.SalonID == salon_id)

    if is_active is not None:
        query = query.where(Customer.IsActive == is_active)

    if search:
        query = query.where(
            or_(
                Customer.FirstName.ilike(f"%{search}%"),
                Customer.LastName.ilike(f"%{search}%"),
                Customer.Mobile.ilike(f"%{search}%"),
                Customer.Email.ilike(f"%{search}%"),
            )
        )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Customer.CreatedAt.desc())
    result = await db.execute(query)
    customers = result.scalars().all()

    return {
        "items": [_format_customer(c) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    existing = await db.execute(
        select(Customer).where(Customer.Mobile == data.mobile, Customer.SalonID == salon_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer with this mobile already exists")

    customer = Customer(
        SalonID=salon_id,
        FirstName=data.first_name,
        LastName=data.last_name,
        Gender=data.gender,
        DateOfBirth=data.date_of_birth,
        Mobile=data.mobile,
        Email=data.email,
        Address=data.address,
        City=data.city,
        Notes=data.notes,
        Preferences=data.preferences,
        ReferralCode=generate_referral_code(),
        ReferredByID=data.referred_by_id,
    )

    if data.referred_by_id:
        referrer = await db.execute(select(Customer).where(Customer.CustomerID == data.referred_by_id))
        referrer_obj = referrer.scalar_one_or_none()
        if referrer_obj:
            referrer_obj.LoyaltyPoints += 50  # referral bonus

    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return _format_customer(customer)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _format_customer(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    for field, value in data.model_dump(exclude_none=True).items():
        field_map = {
            "first_name": "FirstName", "last_name": "LastName", "gender": "Gender",
            "date_of_birth": "DateOfBirth", "mobile": "Mobile", "email": "Email",
            "address": "Address", "city": "City", "notes": "Notes", "preferences": "Preferences",
        }
        if field in field_map:
            setattr(customer, field_map[field], value)

    await db.commit()
    await db.refresh(customer)
    return _format_customer(customer)


@router.delete("/{customer_id}")
async def deactivate_customer(
    customer_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    customer.IsActive = False
    await db.commit()
    return {"message": "Customer deactivated"}


@router.get("/{customer_id}/history")
async def get_customer_history(
    customer_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    from app.models.appointment import Appointment
    from app.models.billing import Invoice

    result = await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    appts_result = await db.execute(
        select(Appointment)
        .where(Appointment.CustomerID == customer_id)
        .order_by(Appointment.AppointmentDate.desc())
        .limit(20)
    )
    appointments = appts_result.scalars().all()

    invoices_result = await db.execute(
        select(Invoice)
        .where(Invoice.CustomerID == customer_id)
        .order_by(Invoice.CreatedAt.desc())
        .limit(20)
    )
    invoices = invoices_result.scalars().all()

    return {
        "customer_id": customer_id,
        "total_visits": customer.TotalVisits,
        "total_spent": float(customer.TotalSpent),
        "loyalty_points": customer.LoyaltyPoints,
        "wallet_balance": float(customer.WalletBalance),
        "last_visit_date": customer.LastVisitDate,
        "appointments": [
            {
                "appointment_id": a.AppointmentID,
                "date": str(a.AppointmentDate),
                "status": a.Status,
                "service_id": a.ServiceID,
            }
            for a in appointments
        ],
        "invoices": [
            {
                "invoice_id": i.InvoiceID,
                "invoice_number": i.InvoiceNumber,
                "total": float(i.TotalAmount),
                "status": i.Status,
                "date": str(i.CreatedAt),
            }
            for i in invoices
        ],
    }


@router.post("/{customer_id}/wallet/add")
async def add_wallet_balance(
    customer_id: int,
    data: AddWalletRequest,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    balance_before = customer.WalletBalance
    customer.WalletBalance += data.amount

    txn = WalletTransaction(
        CustomerID=customer_id,
        Amount=data.amount,
        TransactionType="Credit",
        Description=data.description or "Wallet recharge",
        BalanceAfter=customer.WalletBalance,
    )
    db.add(txn)
    await db.commit()
    return {"message": "Wallet updated", "new_balance": float(customer.WalletBalance)}


@router.get("/membership-plans", response_model=list)
async def get_membership_plans(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(MembershipPlan).where(MembershipPlan.SalonID == salon_id, MembershipPlan.IsActive == True)
    )
    return result.scalars().all()


@router.post("/{customer_id}/membership")
async def assign_membership(
    customer_id: int,
    data: AssignMembershipRequest,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    customer = (await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    plan = (await db.execute(
        select(MembershipPlan).where(MembershipPlan.PlanID == data.plan_id, MembershipPlan.SalonID == salon_id)
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    end_date = date.fromordinal(data.start_date.toordinal() + plan.DurationDays)
    membership = CustomerMembership(
        CustomerID=customer_id,
        PlanID=data.plan_id,
        StartDate=data.start_date,
        EndDate=end_date,
    )
    db.add(membership)

    if plan.LoyaltyBonus > 0:
        customer.LoyaltyPoints += plan.LoyaltyBonus

    await db.commit()
    return {"message": "Membership assigned", "end_date": str(end_date)}


def _format_customer(customer: Customer) -> dict:
    return {
        "customer_id": customer.CustomerID,
        "salon_id": customer.SalonID,
        "first_name": customer.FirstName,
        "last_name": customer.LastName,
        "full_name": f"{customer.FirstName} {customer.LastName}",
        "gender": customer.Gender,
        "date_of_birth": customer.DateOfBirth,
        "mobile": customer.Mobile,
        "email": customer.Email,
        "address": customer.Address,
        "city": customer.City,
        "profile_picture_url": customer.ProfilePictureURL,
        "loyalty_points": customer.LoyaltyPoints,
        "wallet_balance": float(customer.WalletBalance),
        "referral_code": customer.ReferralCode,
        "total_visits": customer.TotalVisits,
        "total_spent": float(customer.TotalSpent),
        "last_visit_date": customer.LastVisitDate,
        "is_active": customer.IsActive,
        "created_at": customer.CreatedAt,
    }


@router.get("/{customer_id}/loyalty")
async def get_customer_loyalty(
    customer_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    customer = (await db.execute(
        select(Customer).where(Customer.CustomerID == customer_id, Customer.SalonID == salon_id)
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    transactions = (await db.execute(
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.CustomerID == customer_id)
        .order_by(LoyaltyTransaction.CreatedAt.desc())
        .limit(100)
    )).scalars().all()

    return {
        "balance": customer.LoyaltyPoints,
        "transactions": [
            {
                "transaction_id": t.TransactionID,
                "customer_id": t.CustomerID,
                "invoice_id": t.InvoiceID,
                "points": t.Points,
                "transaction_type": t.TransactionType,
                "description": t.Description,
                "balance_after": t.BalanceAfter,
                "created_at": t.CreatedAt,
            }
            for t in transactions
        ],
    }
