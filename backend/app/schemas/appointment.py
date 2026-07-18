from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, time
from decimal import Decimal


class AppointmentCreate(BaseModel):
    branch_id: int
    customer_id: int
    staff_id: Optional[int] = None
    service_id: int
    appointment_date: date
    start_time: time
    notes: Optional[str] = None
    booking_source: str = "Online"
    addon_ids: Optional[List[int]] = None


class AppointmentUpdate(BaseModel):
    staff_id: Optional[int] = None
    appointment_date: Optional[date] = None
    start_time: Optional[time] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class AppointmentReschedule(BaseModel):
    appointment_date: date
    start_time: time
    staff_id: Optional[int] = None


class AppointmentCancel(BaseModel):
    cancellation_reason: Optional[str] = None


class AppointmentResponse(BaseModel):
    appointment_id: int
    salon_id: int
    branch_id: int
    customer_id: int
    customer_name: Optional[str]
    customer_mobile: Optional[str]
    staff_id: Optional[int]
    staff_name: Optional[str]
    service_id: int
    service_name: Optional[str]
    service_duration: Optional[int]
    appointment_date: date
    start_time: time
    end_time: time
    status: str
    notes: Optional[str]
    booking_source: str
    service_amount: Optional[Decimal]
    created_at: datetime

    class Config:
        from_attributes = True


class SlotAvailabilityRequest(BaseModel):
    branch_id: int
    service_id: int
    date: date
    staff_id: Optional[int] = None


class TimeSlot(BaseModel):
    start_time: str
    end_time: str
    staff_id: Optional[int]
    staff_name: Optional[str]
    is_available: bool


class WaitlistCreate(BaseModel):
    branch_id: int
    service_id: int
    staff_id: Optional[int] = None
    preferred_date: Optional[date] = None
    preferred_time: Optional[time] = None
    notes: Optional[str] = None
