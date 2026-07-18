from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import date, timedelta
from pydantic import BaseModel

from app.core.database import get_async_db
from app.core.dependencies import get_salon_id, ManagerOrAbove, ReceptionistOrAbove
from app.models.customer import MembershipPlan, CustomerMembership, Customer
from app.models.user import User

router = APIRouter(prefix="/memberships", tags=["Memberships"])


class PlanCreate(BaseModel):
    plan_name: str
    description: Optional[str] = None
    price: float
    duration_days: int = 30
    discount_percent: float = 0
    loyalty_bonus: int = 0
    benefits: Optional[str] = None


class AssignMembership(BaseModel):
    customer_id: int
    plan_id: int
    start_date: Optional[date] = None


@router.get("/plans")
async def list_plans(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    plans = (await db.execute(
        select(MembershipPlan).where(MembershipPlan.SalonID == salon_id, MembershipPlan.IsActive == True)
    )).scalars().all()
    return [
        {
            "plan_id": p.PlanID,
            "plan_name": p.PlanName,
            "description": p.Description,
            "price": float(p.Price),
            "duration_days": p.DurationDays,
            "discount_percent": float(p.DiscountPercent),
            "loyalty_bonus": p.LoyaltyBonus,
            "benefits": p.Benefits,
            "is_active": p.IsActive,
        }
        for p in plans
    ]


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: PlanCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    plan = MembershipPlan(
        SalonID=salon_id,
        PlanName=data.plan_name,
        Description=data.description,
        Price=data.price,
        DurationDays=data.duration_days,
        DiscountPercent=data.discount_percent,
        LoyaltyBonus=data.loyalty_bonus,
        Benefits=data.benefits,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {"plan_id": plan.PlanID, "plan_name": plan.PlanName}


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: int,
    data: PlanCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    plan = (await db.execute(
        select(MembershipPlan).where(MembershipPlan.PlanID == plan_id, MembershipPlan.SalonID == salon_id)
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    plan.PlanName = data.plan_name
    plan.Description = data.description
    plan.Price = data.price
    plan.DurationDays = data.duration_days
    plan.DiscountPercent = data.discount_percent
    plan.LoyaltyBonus = data.loyalty_bonus
    plan.Benefits = data.benefits
    await db.commit()
    return {"plan_id": plan.PlanID}


@router.delete("/plans/{plan_id}")
async def deactivate_plan(
    plan_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    plan = (await db.execute(
        select(MembershipPlan).where(MembershipPlan.PlanID == plan_id, MembershipPlan.SalonID == salon_id)
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    plan.IsActive = False
    await db.commit()
    return {"message": "Plan deactivated"}


@router.get("")
async def list_customer_memberships(
    salon_id: int = Depends(get_salon_id),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    query = (
        select(CustomerMembership, Customer, MembershipPlan)
        .join(Customer, CustomerMembership.CustomerID == Customer.CustomerID)
        .join(MembershipPlan, CustomerMembership.PlanID == MembershipPlan.PlanID)
        .where(Customer.SalonID == salon_id)
    )
    if customer_id:
        query = query.where(CustomerMembership.CustomerID == customer_id)
    if status_filter:
        query = query.where(CustomerMembership.Status == status_filter)
    rows = (await db.execute(query)).all()
    return [
        {
            "membership_id": m.MembershipID,
            "customer_id": m.CustomerID,
            "customer_name": f"{c.FirstName} {c.LastName}",
            "plan_id": m.PlanID,
            "plan_name": p.PlanName,
            "start_date": m.StartDate,
            "end_date": m.EndDate,
            "status": m.Status,
        }
        for m, c, p in rows
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def assign_membership(
    data: AssignMembership,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    plan = (await db.execute(
        select(MembershipPlan).where(MembershipPlan.PlanID == data.plan_id, MembershipPlan.SalonID == salon_id)
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    start = data.start_date or date.today()
    end = start + timedelta(days=plan.DurationDays)

    membership = CustomerMembership(
        CustomerID=data.customer_id,
        PlanID=data.plan_id,
        StartDate=start,
        EndDate=end,
        Status="Active",
    )
    db.add(membership)

    # Add loyalty bonus
    if plan.LoyaltyBonus > 0:
        customer = (await db.execute(select(Customer).where(Customer.CustomerID == data.customer_id))).scalar_one_or_none()
        if customer:
            customer.LoyaltyPoints += plan.LoyaltyBonus

    await db.commit()
    await db.refresh(membership)
    return {"membership_id": membership.MembershipID, "end_date": end}
