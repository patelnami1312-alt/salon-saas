from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    mobile: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    preferences: Optional[str] = None
    referred_by_id: Optional[int] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    preferences: Optional[str] = None


class CustomerResponse(BaseModel):
    customer_id: int
    salon_id: int
    first_name: str
    last_name: str
    full_name: str
    gender: Optional[str]
    date_of_birth: Optional[date]
    mobile: str
    email: Optional[str]
    address: Optional[str]
    city: Optional[str]
    profile_picture_url: Optional[str]
    loyalty_points: int
    wallet_balance: Decimal
    referral_code: Optional[str]
    total_visits: int
    total_spent: Decimal
    last_visit_date: Optional[date]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MembershipPlanCreate(BaseModel):
    plan_name: str
    description: Optional[str] = None
    price: Decimal
    duration_days: int = 30
    discount_percent: Decimal = 0
    loyalty_bonus: int = 0
    benefits: Optional[str] = None


class MembershipPlanResponse(BaseModel):
    plan_id: int
    salon_id: int
    plan_name: str
    description: Optional[str]
    price: Decimal
    duration_days: int
    discount_percent: Decimal
    loyalty_bonus: int
    benefits: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class AssignMembershipRequest(BaseModel):
    plan_id: int
    start_date: date


class AddWalletRequest(BaseModel):
    amount: Decimal
    description: Optional[str] = None


class ReviewCreate(BaseModel):
    branch_id: int
    appointment_id: Optional[int] = None
    staff_id: Optional[int] = None
    rating: int
    review: Optional[str] = None
    is_public: bool = True
