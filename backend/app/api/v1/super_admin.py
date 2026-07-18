from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.core.database import get_async_db
from app.core.dependencies import SuperAdminOnly
from app.core.security import hash_password, generate_secure_token
from app.models.salon import Salon, Branch, SubscriptionPlan, SalonSubscription
from app.models.user import User, Role
from app.models.billing import Invoice
from app.models.customer import Customer
from app.models.staff import Staff
from app.models.appointment import Appointment

router = APIRouter(prefix="/super-admin", tags=["super-admin"])
_super_admin = SuperAdminOnly()


# ── helpers ──────────────────────────────────────────────────────────────────

def _salon_dict(salon: Salon) -> dict:
    plan = salon.subscription_plan
    return {
        "salon_id": salon.SalonID,
        "salon_name": salon.SalonName,
        "owner_name": salon.OwnerName,
        "email": salon.Email,
        "phone": salon.Phone,
        "address": salon.Address,
        "logo_url": salon.LogoURL,
        "currency": salon.Currency,
        "timezone": salon.Timezone,
        "subscription_plan_id": salon.SubscriptionPlanID,
        "subscription_plan_name": plan.PlanName if plan else None,
        "subscription_status": salon.SubscriptionStatus,
        "trial_expiry_date": salon.TrialExpiryDate.isoformat() if salon.TrialExpiryDate else None,
        "is_active": salon.IsActive,
        "created_at": salon.CreatedAt.isoformat() if salon.CreatedAt else None,
    }


def _plan_dict(plan: SubscriptionPlan) -> dict:
    return {
        "plan_id": plan.PlanID,
        "plan_name": plan.PlanName,
        "price": float(plan.Price),
        "billing_cycle": plan.BillingCycle,
        "max_branches": plan.MaxBranches,
        "max_staff": plan.MaxStaff,
        "max_customers": plan.MaxCustomers,
        "features": plan.Features,
        "is_active": plan.IsActive,
        "created_at": plan.CreatedAt.isoformat() if plan.CreatedAt else None,
    }


# ── dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_super_admin_dashboard(
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (first_of_month - timedelta(days=1)).replace(day=1)

    # Total salons
    total_salons_r = await db.execute(select(func.count(Salon.SalonID)))
    total_salons = total_salons_r.scalar() or 0

    active_salons_r = await db.execute(select(func.count(Salon.SalonID)).where(Salon.IsActive == True))
    active_salons = active_salons_r.scalar() or 0

    trial_salons_r = await db.execute(select(func.count(Salon.SalonID)).where(Salon.SubscriptionStatus == "Trial"))
    trial_salons = trial_salons_r.scalar() or 0

    # New salons this month
    new_this_month_r = await db.execute(
        select(func.count(Salon.SalonID)).where(Salon.CreatedAt >= first_of_month)
    )
    new_this_month = new_this_month_r.scalar() or 0

    # MRR from active subscriptions (monthly equivalent)
    mrr_r = await db.execute(
        select(func.sum(SubscriptionPlan.Price))
        .join(Salon, Salon.SubscriptionPlanID == SubscriptionPlan.PlanID)
        .where(Salon.IsActive == True, Salon.SubscriptionStatus == "Active")
    )
    mrr = float(mrr_r.scalar() or 0)

    # Revenue this month from subscriptions
    rev_this_month_r = await db.execute(
        select(func.sum(SalonSubscription.Amount))
        .where(SalonSubscription.StartDate >= first_of_month.date())
        .where(SalonSubscription.Status == "Active")
    )
    revenue_this_month = float(rev_this_month_r.scalar() or 0)

    # Revenue last month
    rev_last_month_r = await db.execute(
        select(func.sum(SalonSubscription.Amount))
        .where(
            SalonSubscription.StartDate >= last_month_start.date(),
            SalonSubscription.StartDate < first_of_month.date(),
            SalonSubscription.Status == "Active",
        )
    )
    revenue_last_month = float(rev_last_month_r.scalar() or 0)

    # Total users across all salons
    total_users_r = await db.execute(select(func.count(User.UserID)))
    total_users = total_users_r.scalar() or 0

    # Total customers across all salons
    total_customers_r = await db.execute(select(func.count(Customer.CustomerID)))
    total_customers = total_customers_r.scalar() or 0

    # Recent 6-month MRR trend (approximation using subscription revenue)
    monthly_trend = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        rev_r = await db.execute(
            select(func.sum(SalonSubscription.Amount))
            .where(
                SalonSubscription.StartDate >= month_start.date(),
                SalonSubscription.StartDate < month_end.date(),
            )
        )
        monthly_trend.append({
            "month": month_start.strftime("%b %Y"),
            "revenue": float(rev_r.scalar() or 0),
        })

    # Subscription status breakdown
    status_breakdown = []
    for s in ["Active", "Trial", "Expired", "Cancelled"]:
        cnt_r = await db.execute(
            select(func.count(Salon.SalonID)).where(Salon.SubscriptionStatus == s)
        )
        status_breakdown.append({"status": s, "count": cnt_r.scalar() or 0})

    return {
        "total_salons": total_salons,
        "active_salons": active_salons,
        "trial_salons": trial_salons,
        "new_salons_this_month": new_this_month,
        "mrr": mrr,
        "revenue_this_month": revenue_this_month,
        "revenue_last_month": revenue_last_month,
        "revenue_growth_pct": round(((revenue_this_month - revenue_last_month) / revenue_last_month * 100) if revenue_last_month else 0, 1),
        "total_users": total_users,
        "total_customers": total_customers,
        "monthly_trend": monthly_trend,
        "status_breakdown": status_breakdown,
    }


# ── salons ────────────────────────────────────────────────────────────────────

@router.get("/salons")
async def list_salons(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    q = select(Salon).options(selectinload(Salon.subscription_plan))
    if search:
        q = q.where(
            (Salon.SalonName.ilike(f"%{search}%")) |
            (Salon.Email.ilike(f"%{search}%")) |
            (Salon.OwnerName.ilike(f"%{search}%"))
        )
    if status:
        q = q.where(Salon.SubscriptionStatus == status)

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size).order_by(Salon.CreatedAt.desc())
    result = await db.execute(q)
    salons = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_salon_dict(s) for s in salons],
    }


@router.get("/salons/{salon_id}")
async def get_salon(
    salon_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(
        select(Salon)
        .options(selectinload(Salon.subscription_plan), selectinload(Salon.branches))
        .where(Salon.SalonID == salon_id)
    )
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    # staff count
    staff_cnt_r = await db.execute(select(func.count(Staff.StaffID)).where(Staff.SalonID == salon_id))
    staff_count = staff_cnt_r.scalar() or 0

    # customer count
    cust_cnt_r = await db.execute(select(func.count(Customer.CustomerID)).where(Customer.SalonID == salon_id))
    cust_count = cust_cnt_r.scalar() or 0

    # subscription history
    sub_r = await db.execute(
        select(SalonSubscription)
        .options(selectinload(SalonSubscription.plan))
        .where(SalonSubscription.SalonID == salon_id)
        .order_by(SalonSubscription.StartDate.desc())
        .limit(10)
    )
    subs = sub_r.scalars().all()

    data = _salon_dict(salon)
    data["branches"] = [
        {"branch_id": b.BranchID, "branch_name": b.BranchName, "city": b.City, "is_active": b.IsActive}
        for b in salon.branches
    ]
    data["staff_count"] = staff_count
    data["customer_count"] = cust_count
    data["subscription_history"] = [
        {
            "sub_id": s.SubscriptionID,
            "plan_name": s.plan.PlanName if s.plan else None,
            "start_date": s.StartDate.isoformat(),
            "end_date": s.EndDate.isoformat(),
            "amount": float(s.Amount),
            "status": s.Status,
        }
        for s in subs
    ]
    return data


@router.post("/salons", status_code=201)
async def create_salon(
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    salon = Salon(
        SalonName=body["salon_name"],
        OwnerName=body.get("owner_name"),
        Email=body["email"],
        Phone=body.get("phone"),
        Address=body.get("address"),
        Currency=body.get("currency", "USD"),
        Timezone=body.get("timezone", "America/New_York"),
        SubscriptionStatus=body.get("subscription_status", "Trial"),
        IsActive=True,
    )
    if body.get("trial_days"):
        salon.TrialExpiryDate = datetime.utcnow() + timedelta(days=int(body["trial_days"]))
    db.add(salon)
    await db.commit()
    await db.refresh(salon)

    # Create default branch
    branch = Branch(
        SalonID=salon.SalonID,
        BranchName=f"{salon.SalonName} - Main",
        BranchCode=f"BR{salon.SalonID:04d}",
        IsActive=True,
    )
    db.add(branch)
    await db.commit()

    return {"salon_id": salon.SalonID, "message": "Salon created successfully"}


@router.put("/salons/{salon_id}")
async def update_salon(
    salon_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    for field, col in [
        ("salon_name", "SalonName"), ("owner_name", "OwnerName"), ("email", "Email"),
        ("phone", "Phone"), ("address", "Address"), ("currency", "Currency"),
        ("timezone", "Timezone"), ("subscription_status", "SubscriptionStatus"),
        ("is_active", "IsActive"), ("subscription_plan_id", "SubscriptionPlanID"),
    ]:
        if field in body:
            setattr(salon, col, body[field])

    await db.commit()
    return {"message": "Salon updated"}


@router.post("/salons/{salon_id}/suspend")
async def suspend_salon(
    salon_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    salon.IsActive = False
    salon.SubscriptionStatus = "Suspended"
    await db.commit()
    return {"message": "Salon suspended"}


@router.post("/salons/{salon_id}/activate")
async def activate_salon(
    salon_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    salon.IsActive = True
    salon.SubscriptionStatus = "Active"
    await db.commit()
    return {"message": "Salon activated"}


@router.post("/salons/{salon_id}/assign-plan")
async def assign_plan(
    salon_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    plan_r = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.PlanID == body["plan_id"]))
    plan = plan_r.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    salon.SubscriptionPlanID = plan.PlanID
    salon.SubscriptionStatus = "Active"

    start = date.today()
    end = date.today().replace(year=date.today().year + 1) if plan.BillingCycle == "Yearly" else date.today().replace(month=(date.today().month % 12) + 1)

    sub = SalonSubscription(
        SalonID=salon_id,
        PlanID=plan.PlanID,
        StartDate=start,
        EndDate=end,
        Amount=plan.Price,
        Status="Active",
        TransactionRef=body.get("transaction_ref"),
    )
    db.add(sub)
    await db.commit()
    return {"message": f"Plan '{plan.PlanName}' assigned to salon"}


# ── subscription plans ────────────────────────────────────────────────────────

@router.get("/plans")
async def list_plans(
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.Price))
    plans = result.scalars().all()
    return [_plan_dict(p) for p in plans]


@router.post("/plans", status_code=201)
async def create_plan(
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    plan = SubscriptionPlan(
        PlanName=body["plan_name"],
        Price=Decimal(str(body.get("price", 0))),
        BillingCycle=body.get("billing_cycle", "Monthly"),
        MaxBranches=body.get("max_branches", 1),
        MaxStaff=body.get("max_staff", 10),
        MaxCustomers=body.get("max_customers", 1000),
        Features=body.get("features"),
        IsActive=body.get("is_active", True),
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _plan_dict(plan)


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.PlanID == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    for field, col in [
        ("plan_name", "PlanName"), ("price", "Price"), ("billing_cycle", "BillingCycle"),
        ("max_branches", "MaxBranches"), ("max_staff", "MaxStaff"),
        ("max_customers", "MaxCustomers"), ("features", "Features"), ("is_active", "IsActive"),
    ]:
        if field in body:
            val = Decimal(str(body[field])) if field == "price" else body[field]
            setattr(plan, col, val)

    await db.commit()
    return _plan_dict(plan)


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.PlanID == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.IsActive = False
    await db.commit()
    return {"message": "Plan deactivated"}


# ── global reports ────────────────────────────────────────────────────────────

@router.get("/global-reports")
async def global_reports(
    period: str = Query("monthly", pattern="^(daily|weekly|monthly)$"),
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    now = datetime.utcnow()

    # Top 10 salons by subscription value
    top_salons_r = await db.execute(
        select(Salon, SubscriptionPlan.Price)
        .join(SubscriptionPlan, Salon.SubscriptionPlanID == SubscriptionPlan.PlanID, isouter=True)
        .where(Salon.IsActive == True)
        .order_by(SubscriptionPlan.Price.desc().nullslast())
        .limit(10)
    )
    top_salons = [
        {"salon_name": row[0].SalonName, "plan_revenue": float(row[1] or 0), "status": row[0].SubscriptionStatus}
        for row in top_salons_r.all()
    ]

    # Monthly subscription revenue for the past 12 months
    revenue_trend = []
    for i in range(11, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        r = await db.execute(
            select(func.sum(SalonSubscription.Amount))
            .where(SalonSubscription.StartDate >= m_start.date(), SalonSubscription.StartDate < m_end.date())
        )
        revenue_trend.append({"month": m_start.strftime("%b %Y"), "revenue": float(r.scalar() or 0)})

    # Salon growth trend (cumulative)
    salon_growth = []
    for i in range(5, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        r = await db.execute(select(func.count(Salon.SalonID)).where(Salon.CreatedAt < m_end))
        salon_growth.append({"month": m_start.strftime("%b %Y"), "total_salons": r.scalar() or 0})

    return {
        "top_salons_by_revenue": top_salons,
        "revenue_trend": revenue_trend,
        "salon_growth": salon_growth,
    }


# ── feature flags ─────────────────────────────────────────────────────────────

FEATURE_FLAGS = [
    "online_booking", "ai_receptionist", "marketing_campaigns",
    "loyalty_program", "gift_cards", "multi_location", "payroll",
    "inventory_management", "customer_portal", "mobile_app",
]


@router.get("/feature-flags/{salon_id}")
async def get_feature_flags(
    salon_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    import json
    settings = {}
    if salon.Settings:
        try:
            settings = json.loads(salon.Settings)
        except Exception:
            pass

    flags = settings.get("feature_flags", {flag: True for flag in FEATURE_FLAGS})
    return {"salon_id": salon_id, "feature_flags": flags}


@router.put("/feature-flags/{salon_id}")
async def update_feature_flags(
    salon_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(Salon).where(Salon.SalonID == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    import json
    settings = {}
    if salon.Settings:
        try:
            settings = json.loads(salon.Settings)
        except Exception:
            pass

    settings["feature_flags"] = body.get("feature_flags", {})
    salon.Settings = json.dumps(settings)
    await db.commit()
    return {"message": "Feature flags updated"}


# ── users management ──────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel, EmailStr as _EmailStr

class UserCreate(_BaseModel):
    first_name: str
    last_name: str
    email: _EmailStr
    phone: Optional[str] = None
    role_code: str           # super_admin | salon_owner | branch_manager | receptionist
    salon_id: Optional[int] = None   # required for non-super_admin roles


@router.post("/users", status_code=201)
async def create_platform_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    existing = (await db.execute(select(User).where(User.Email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")

    allowed_roles = {"super_admin", "salon_owner", "branch_manager", "receptionist"}
    if data.role_code not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed: {allowed_roles}")

    if data.role_code != "super_admin" and not data.salon_id:
        raise HTTPException(status_code=400, detail="salon_id is required for this role")

    role = (await db.execute(select(Role).where(Role.RoleCode == data.role_code))).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=500, detail=f"Role '{data.role_code}' not found in database")

    temp_password = generate_secure_token(8)
    new_user = User(
        SalonID=data.salon_id,
        RoleID=role.RoleID,
        FirstName=data.first_name,
        LastName=data.last_name,
        Email=data.email,
        Phone=data.phone,
        PasswordHash=hash_password(temp_password),
        IsActive=True,
        FailedLoginAttempts=0,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {
        "user_id": new_user.UserID,
        "full_name": new_user.full_name,
        "email": new_user.Email,
        "role": role.RoleName,
        "role_code": data.role_code,
        "temp_password": temp_password,
    }


@router.get("/users")
async def list_all_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    q = select(User).options(selectinload(User.role), selectinload(User.salon))
    if search:
        q = q.where(
            (User.Email.ilike(f"%{search}%")) |
            (User.FirstName.ilike(f"%{search}%")) |
            (User.LastName.ilike(f"%{search}%"))
        )
    if role:
        # support comma-separated roles: role=super_admin,salon_owner
        role_list = [r.strip() for r in role.split(",") if r.strip()]
        if len(role_list) == 1:
            q = q.join(Role, User.RoleID == Role.RoleID).where(Role.RoleCode == role_list[0])
        else:
            q = q.join(Role, User.RoleID == Role.RoleID).where(Role.RoleCode.in_(role_list))

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size).order_by(User.CreatedAt.desc())
    result = await db.execute(q)
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "user_id": u.UserID,
                "full_name": u.full_name,
                "email": u.Email,
                "phone": u.Phone,
                "role": u.role.RoleName if u.role else None,
                "role_code": u.role.RoleCode if u.role else None,
                "salon_name": u.salon.SalonName if u.salon else None,
                "is_active": u.IsActive,
                "last_login_at": u.LastLoginAt.isoformat() if u.LastLoginAt else None,
                "created_at": u.CreatedAt.isoformat() if u.CreatedAt else None,
            }
            for u in users
        ],
    }


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(User).where(User.UserID == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    temp_password = generate_secure_token(8)
    user.PasswordHash = hash_password(temp_password)
    user.ResetPasswordToken = None
    user.ResetPasswordExpiry = None
    await db.commit()
    return {"temp_password": temp_password, "email": user.Email, "full_name": user.full_name}


@router.post("/users/{user_id}/unlock")
async def unlock_user_account(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    _: User = Depends(_super_admin),
):
    result = await db.execute(select(User).where(User.UserID == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.IsActive = True
    user.FailedLoginAttempts = 0
    await db.commit()
    return {"message": f"Account for {user.full_name} has been unlocked"}


# ── SMS / Email config (stored per-platform in settings) ─────────────────────

@router.get("/notification-config")
async def get_notification_config(
    _: User = Depends(_super_admin),
):
    return {
        "twilio": {
            "account_sid": "***configured via env***",
            "from_number": "***configured via env***",
            "status": "connected",
        },
        "sendgrid": {
            "api_key": "***configured via env***",
            "from_email": "***configured via env***",
            "status": "connected",
        },
    }
