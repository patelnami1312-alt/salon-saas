"""Customer-facing portal API — customers login with mobile/email + OTP or password."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_async_db
from app.core.security import create_access_token, verify_password, hash_password
from app.models.customer import Customer, CustomerAuth, LoyaltyTransaction, CustomerMembership, MembershipPlan
from app.models.appointment import Appointment
from app.models.service import Service
from app.models.billing import Invoice, GiftCard
from app.models.staff import Staff
from app.models.user import User as AdminUser

router = APIRouter(prefix="/customer-portal", tags=["Customer Portal"])


class CustomerRegister(BaseModel):
    first_name: str
    last_name: str
    mobile: str
    email: Optional[str] = None
    password: str
    salon_id: int


class CustomerLogin(BaseModel):
    mobile: str
    password: str
    salon_id: int


class CustomerLoginResponse(BaseModel):
    access_token: str
    customer_id: int
    first_name: str
    last_name: str
    mobile: str
    email: Optional[str]
    loyalty_points: int
    wallet_balance: float


async def get_portal_customer(token: str, db: AsyncSession) -> Customer:
    from app.core.security import decode_token
    from fastapi import HTTPException
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("token_type") != "customer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a customer token")
    customer_id = payload.get("customer_id")
    customer = (await db.execute(select(Customer).where(Customer.CustomerID == customer_id))).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Customer not found")
    return customer


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def customer_register(
    data: CustomerRegister,
    db: AsyncSession = Depends(get_async_db),
):
    existing = (await db.execute(
        select(Customer).where(Customer.Mobile == data.mobile, Customer.SalonID == data.salon_id)
    )).scalar_one_or_none()

    if existing:
        auth = (await db.execute(select(CustomerAuth).where(CustomerAuth.CustomerID == existing.CustomerID))).scalar_one_or_none()
        if auth:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mobile already registered")
        customer = existing
    else:
        customer = Customer(
            SalonID=data.salon_id,
            FirstName=data.first_name,
            LastName=data.last_name,
            Mobile=data.mobile,
            Email=data.email,
        )
        db.add(customer)
        await db.flush()

    auth = CustomerAuth(
        CustomerID=customer.CustomerID,
        PasswordHash=hash_password(data.password),
        IsEmailVerified=False,
    )
    db.add(auth)
    await db.commit()

    token = create_access_token(
        data={"customer_id": customer.CustomerID, "token_type": "customer"},
        expires_delta=timedelta(days=30),
    )
    return {
        "access_token": token,
        "customer_id": customer.CustomerID,
        "first_name": customer.FirstName,
        "last_name": customer.LastName,
        "mobile": customer.Mobile,
        "email": customer.Email,
        "loyalty_points": customer.LoyaltyPoints,
        "wallet_balance": float(customer.WalletBalance),
    }


@router.post("/login")
async def customer_login(
    data: CustomerLogin,
    db: AsyncSession = Depends(get_async_db),
):
    customer = (await db.execute(
        select(Customer).where(Customer.Mobile == data.mobile, Customer.SalonID == data.salon_id, Customer.IsActive == True)
    )).scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mobile number not found")

    auth = (await db.execute(select(CustomerAuth).where(CustomerAuth.CustomerID == customer.CustomerID))).scalar_one_or_none()
    if not auth or not verify_password(data.password, auth.PasswordHash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    auth.LastLoginAt = datetime.now()
    await db.commit()

    token = create_access_token(
        data={"customer_id": customer.CustomerID, "token_type": "customer"},
        expires_delta=timedelta(days=30),
    )
    return {
        "access_token": token,
        "customer_id": customer.CustomerID,
        "first_name": customer.FirstName,
        "last_name": customer.LastName,
        "mobile": customer.Mobile,
        "email": customer.Email,
        "loyalty_points": customer.LoyaltyPoints,
        "wallet_balance": float(customer.WalletBalance),
    }


@router.get("/profile")
async def get_profile(
    token: str,
    db: AsyncSession = Depends(get_async_db),
):
    customer = await get_portal_customer(token, db)

    # Get active membership
    mem_row = (await db.execute(
        select(CustomerMembership, MembershipPlan)
        .join(MembershipPlan, CustomerMembership.PlanID == MembershipPlan.PlanID)
        .where(CustomerMembership.CustomerID == customer.CustomerID, CustomerMembership.Status == "Active")
        .order_by(CustomerMembership.EndDate.desc())
        .limit(1)
    )).first()

    membership = None
    if mem_row:
        m, p = mem_row
        membership = {"plan_name": p.PlanName, "end_date": str(m.EndDate), "discount_percent": float(p.DiscountPercent)}

    return {
        "customer_id": customer.CustomerID,
        "first_name": customer.FirstName,
        "last_name": customer.LastName,
        "mobile": customer.Mobile,
        "email": customer.Email,
        "loyalty_points": customer.LoyaltyPoints,
        "wallet_balance": float(customer.WalletBalance),
        "total_visits": customer.TotalVisits,
        "total_spent": float(customer.TotalSpent),
        "last_visit_date": str(customer.LastVisitDate) if customer.LastVisitDate else None,
        "membership": membership,
    }


@router.get("/appointments")
async def get_customer_appointments(
    token: str,
    upcoming_only: bool = False,
    db: AsyncSession = Depends(get_async_db),
):
    customer = await get_portal_customer(token, db)
    from datetime import date

    query = select(Appointment).where(Appointment.CustomerID == customer.CustomerID)
    if upcoming_only:
        query = query.where(
            Appointment.AppointmentDate >= date.today(),
            Appointment.Status.notin_(["Cancelled", "NoShow"]),
        )
    query = query.order_by(Appointment.AppointmentDate.desc(), Appointment.StartTime.desc()).limit(50)
    appointments = (await db.execute(query)).scalars().all()

    results = []
    for a in appointments:
        service = (await db.execute(select(Service).where(Service.ServiceID == a.ServiceID))).scalar_one_or_none()
        staff_user = None
        if a.StaffID:
            staff = (await db.execute(select(Staff).where(Staff.StaffID == a.StaffID))).scalar_one_or_none()
            if staff:
                u = (await db.execute(select(AdminUser).where(AdminUser.UserID == staff.UserID))).scalar_one_or_none()
                staff_user = f"{u.FirstName} {u.LastName}" if u else None

        results.append({
            "appointment_id": a.AppointmentID,
            "service_name": service.ServiceName if service else "Unknown",
            "service_price": float(service.Price) if service else 0,
            "staff_name": staff_user,
            "date": str(a.AppointmentDate),
            "time": str(a.StartTime),
            "status": a.Status,
            "booking_source": a.BookingSource,
        })
    return results


@router.get("/loyalty")
async def get_customer_loyalty(
    token: str,
    db: AsyncSession = Depends(get_async_db),
):
    customer = await get_portal_customer(token, db)
    txns = (await db.execute(
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.CustomerID == customer.CustomerID)
        .order_by(LoyaltyTransaction.CreatedAt.desc())
        .limit(30)
    )).scalars().all()

    return {
        "balance": customer.LoyaltyPoints,
        "estimated_value": customer.LoyaltyPoints * 0.01,
        "transactions": [
            {
                "points": t.Points,
                "type": t.TransactionType,
                "description": t.Description,
                "balance_after": t.BalanceAfter,
                "date": str(t.CreatedAt),
            }
            for t in txns
        ],
    }


@router.get("/lookup")
async def lookup_by_mobile(
    mobile: str,
    salon_id: int = 1,
    db: AsyncSession = Depends(get_async_db),
):
    """No-password booking lookup — customer enters their phone to see appointments."""
    from datetime import date as date_type
    customer = (await db.execute(
        select(Customer).where(Customer.Mobile == mobile, Customer.SalonID == salon_id, Customer.IsActive == True)
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No bookings found for this number")

    query = (
        select(Appointment)
        .where(Appointment.CustomerID == customer.CustomerID)
        .order_by(Appointment.AppointmentDate.desc(), Appointment.StartTime.desc())
        .limit(20)
    )
    appointments = (await db.execute(query)).scalars().all()

    results = []
    for a in appointments:
        service = (await db.execute(select(Service).where(Service.ServiceID == a.ServiceID))).scalar_one_or_none()
        staff_name = None
        if a.StaffID:
            staff = (await db.execute(select(Staff).where(Staff.StaffID == a.StaffID))).scalar_one_or_none()
            if staff:
                u = (await db.execute(select(AdminUser).where(AdminUser.UserID == staff.UserID))).scalar_one_or_none()
                staff_name = f"{u.FirstName} {u.LastName}" if u else None
        results.append({
            "appointment_id": a.AppointmentID,
            "confirmation_number": f"BK-{a.AppointmentID:06d}",
            "service_name": service.ServiceName if service else "Unknown",
            "service_price": float(service.Price) if service else 0,
            "staff_name": staff_name,
            "date": str(a.AppointmentDate),
            "time": str(a.StartTime)[:5],
            "status": a.Status,
            "booking_source": a.BookingSource,
        })

    return {
        "customer_id": customer.CustomerID,
        "first_name": customer.FirstName,
        "last_name": customer.LastName,
        "mobile": customer.Mobile,
        "loyalty_points": customer.LoyaltyPoints,
        "total_visits": customer.TotalVisits,
        "appointments": results,
    }


@router.get("/gift-cards")
async def get_customer_gift_cards(
    token: str,
    salon_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    customer = await get_portal_customer(token, db)
    cards = (await db.execute(
        select(GiftCard).where(
            GiftCard.PurchasedByCustomerID == customer.CustomerID,
            GiftCard.SalonID == salon_id,
        ).order_by(GiftCard.CreatedAt.desc())
    )).scalars().all()

    return [
        {
            "code": c.Code,
            "initial_amount": float(c.InitialAmount),
            "balance": float(c.Balance),
            "is_active": c.IsActive,
            "expiry_date": str(c.ExpiryDate) if c.ExpiryDate else None,
        }
        for c in cards
    ]
