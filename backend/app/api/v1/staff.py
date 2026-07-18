from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from datetime import date
import math

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ManagerOrAbove, ReceptionistOrAbove
from app.core.security import hash_password, generate_secure_token
from app.models.staff import Staff, StaffSchedule, StaffAttendance, Leave
from app.models.user import User, Role
from app.models.service import StaffService

router = APIRouter(prefix="/staff", tags=["Staff"])


class StaffCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    branch_id: int
    job_title: Optional[str] = None
    skills: Optional[str] = None
    experience: int = 0
    salary: float = 0
    commission_percent: float = 0
    joining_date: Optional[date] = None
    gender: Optional[str] = None
    service_ids: Optional[List[int]] = None


class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[int] = None
    salary: Optional[float] = None
    commission_percent: Optional[float] = None
    gender: Optional[str] = None
    service_ids: Optional[List[int]] = None


class ScheduleCreate(BaseModel):
    schedules: List[dict]  # [{day_of_week, start_time, end_time, is_working}]


class AttendanceCreate(BaseModel):
    staff_id: int
    attendance_date: date
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    status: str = "Present"
    notes: Optional[str] = None


class LeaveCreate(BaseModel):
    leave_type: str
    from_date: date
    to_date: date
    reason: Optional[str] = None


class LeaveApproval(BaseModel):
    status: str  # Approved, Rejected
    rejection_reason: Optional[str] = None


@router.get("")
async def list_staff(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    query = select(Staff, User).join(User, User.UserID == Staff.UserID).where(Staff.SalonID == salon_id)

    if branch_id:
        query = query.where(Staff.BranchID == branch_id)
    if is_active is not None:
        query = query.where(Staff.IsActive == is_active)
    if search:
        query = query.where(
            (User.FirstName + " " + User.LastName).ilike(f"%{search}%") |
            User.Email.ilike(f"%{search}%") |
            User.Phone.ilike(f"%{search}%")
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    return {
        "items": [
            {
                "staff_id": staff.StaffID,
                "user_id": user.UserID,
                "branch_id": staff.BranchID,
                "first_name": user.FirstName,
                "last_name": user.LastName,
                "full_name": f"{user.FirstName} {user.LastName}",
                "email": user.Email,
                "phone": user.Phone,
                "job_title": staff.JobTitle,
                "skills": staff.Skills,
                "experience": staff.Experience,
                "commission_percent": float(staff.CommissionPercent),
                "average_rating": float(staff.AverageRating),
                "total_serviced": staff.TotalServiced,
                "is_active": staff.IsActive,
                "profile_picture_url": user.ProfilePictureURL,
            }
            for staff, user in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_staff(
    data: StaffCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    existing = (await db.execute(select(User).where(User.Email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    role = (await db.execute(select(Role).where(Role.RoleCode == "staff"))).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Staff role not configured")

    temp_password = generate_secure_token(8)
    user = User(
        SalonID=salon_id,
        BranchID=data.branch_id,
        RoleID=role.RoleID,
        FirstName=data.first_name,
        LastName=data.last_name,
        Email=data.email,
        Phone=data.phone,
        PasswordHash=hash_password(temp_password),
    )
    db.add(user)
    await db.flush()

    staff_count = (await db.execute(select(func.count()).where(Staff.SalonID == salon_id))).scalar() or 0
    staff_code = f"STF{salon_id:04d}{staff_count + 1:04d}"

    staff = Staff(
        UserID=user.UserID,
        BranchID=data.branch_id,
        SalonID=salon_id,
        StaffCode=staff_code,
        JobTitle=data.job_title,
        Skills=data.skills,
        Experience=data.experience,
        Salary=data.salary,
        CommissionPercent=data.commission_percent,
        JoiningDate=data.joining_date,
        Gender=data.gender,
    )
    db.add(staff)
    await db.flush()

    if data.service_ids:
        for service_id in data.service_ids:
            db.add(StaffService(StaffID=staff.StaffID, ServiceID=service_id))

    await db.commit()
    return {
        "staff_id": staff.StaffID,
        "staff_code": staff_code,
        "temp_password": temp_password,
        "message": "Staff created. Share temp_password with staff member.",
    }


@router.get("/{staff_id}")
async def get_staff(
    staff_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Staff, User).join(User, User.UserID == Staff.UserID)
        .where(Staff.StaffID == staff_id, Staff.SalonID == salon_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")

    staff, user = row

    services_result = await db.execute(
        select(StaffService).where(StaffService.StaffID == staff_id)
    )
    service_ids = [ss.ServiceID for ss in services_result.scalars().all()]

    schedules_result = await db.execute(
        select(StaffSchedule).where(StaffSchedule.StaffID == staff_id)
    )
    schedules = schedules_result.scalars().all()

    return {
        "staff_id": staff.StaffID,
        "user_id": user.UserID,
        "branch_id": staff.BranchID,
        "salon_id": staff.SalonID,
        "staff_code": staff.StaffCode,
        "first_name": user.FirstName,
        "last_name": user.LastName,
        "email": user.Email,
        "phone": user.Phone,
        "job_title": staff.JobTitle,
        "skills": staff.Skills,
        "experience": staff.Experience,
        "salary": float(staff.Salary),
        "commission_percent": float(staff.CommissionPercent),
        "joining_date": staff.JoiningDate,
        "gender": staff.Gender,
        "is_active": staff.IsActive,
        "total_serviced": staff.TotalServiced,
        "average_rating": float(staff.AverageRating),
        "profile_picture_url": user.ProfilePictureURL,
        "service_ids": service_ids,
        "schedules": [
            {
                "day_of_week": s.DayOfWeek,
                "start_time": str(s.StartTime),
                "end_time": str(s.EndTime),
                "is_working": s.IsWorking,
            }
            for s in schedules
        ],
    }


@router.put("/{staff_id}")
async def update_staff(
    staff_id: int,
    data: StaffUpdate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    result = await db.execute(
        select(Staff, User).join(User, User.UserID == Staff.UserID)
        .where(Staff.StaffID == staff_id, Staff.SalonID == salon_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")
    staff, user = row

    if data.first_name is not None:
        user.FirstName = data.first_name
    if data.last_name is not None:
        user.LastName = data.last_name
    if data.phone is not None:
        user.Phone = data.phone
    if data.job_title is not None:
        staff.JobTitle = data.job_title
    if data.skills is not None:
        staff.Skills = data.skills
    if data.experience is not None:
        staff.Experience = data.experience
    if data.salary is not None:
        staff.Salary = data.salary
    if data.commission_percent is not None:
        staff.CommissionPercent = data.commission_percent
    if data.gender is not None:
        staff.Gender = data.gender

    if data.service_ids is not None:
        existing_svcs = await db.execute(select(StaffService).where(StaffService.StaffID == staff_id))
        for ss in existing_svcs.scalars().all():
            await db.delete(ss)
        for sid in data.service_ids:
            db.add(StaffService(StaffID=staff_id, ServiceID=sid))

    await db.commit()
    return {"staff_id": staff_id, "message": "Staff updated"}


@router.put("/{staff_id}/schedule")
async def update_schedule(
    staff_id: int,
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    existing = await db.execute(select(StaffSchedule).where(StaffSchedule.StaffID == staff_id))
    for s in existing.scalars().all():
        await db.delete(s)

    for sched in data.schedules:
        db.add(StaffSchedule(
            StaffID=staff_id,
            DayOfWeek=sched["day_of_week"],
            StartTime=sched["start_time"],
            EndTime=sched["end_time"],
            IsWorking=sched.get("is_working", True),
        ))
    await db.commit()
    return {"message": "Schedule updated"}


@router.post("/attendance")
async def record_attendance(
    data: AttendanceCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    existing = (await db.execute(
        select(StaffAttendance).where(
            StaffAttendance.StaffID == data.staff_id,
            StaffAttendance.AttendanceDate == data.attendance_date,
        )
    )).scalar_one_or_none()

    if existing:
        existing.Status = data.status
        existing.Notes = data.notes
    else:
        db.add(StaffAttendance(
            StaffID=data.staff_id,
            AttendanceDate=data.attendance_date,
            Status=data.status,
            Notes=data.notes,
            MarkedByUserID=current_user.UserID,
        ))
    await db.commit()
    return {"message": "Attendance recorded"}


@router.post("/{staff_id}/leaves")
async def apply_leave(
    staff_id: int,
    data: LeaveCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    days = (data.to_date - data.from_date).days + 1
    leave = Leave(
        StaffID=staff_id,
        LeaveType=data.leave_type,
        FromDate=data.from_date,
        ToDate=data.to_date,
        TotalDays=days,
        Reason=data.reason,
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    return {"leave_id": leave.LeaveID, "total_days": days, "status": leave.Status}


@router.put("/{staff_id}/leaves/{leave_id}/approve")
async def approve_leave(
    staff_id: int,
    leave_id: int,
    data: LeaveApproval,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    leave = (await db.execute(
        select(Leave).where(Leave.LeaveID == leave_id, Leave.StaffID == staff_id)
    )).scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave not found")

    from datetime import datetime
    leave.Status = data.status
    leave.ApprovedByUserID = current_user.UserID
    leave.ApprovedAt = datetime.now()
    if data.rejection_reason:
        leave.RejectionReason = data.rejection_reason

    await db.commit()
    return {"message": f"Leave {data.status.lower()}", "leave_id": leave_id}
