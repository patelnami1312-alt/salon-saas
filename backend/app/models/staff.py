from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, ForeignKey, func, Time
from sqlalchemy.orm import relationship
from app.core.database import Base


class Staff(Base):
    __tablename__ = "Staff"

    StaffID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False, unique=True)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False, index=True)
    StaffCode = Column(String(50), unique=True)
    JobTitle = Column(String(100))
    Skills = Column(String)
    Experience = Column(Integer, nullable=False, default=0)
    Salary = Column(Numeric(10, 2), nullable=False, default=0)
    CommissionPercent = Column(Numeric(5, 2), nullable=False, default=0)
    JoiningDate = Column(Date)
    Gender = Column(String(20))
    IsActive = Column(Boolean, nullable=False, default=True)
    TotalServiced = Column(Integer, nullable=False, default=0)
    AverageRating = Column(Numeric(3, 2), nullable=False, default=0)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="staff_profile")
    salon = relationship("Salon", back_populates="staff")
    branch = relationship("Branch", back_populates="staff")
    schedules = relationship("StaffSchedule", back_populates="staff")
    attendance = relationship("StaffAttendance", back_populates="staff")
    leaves = relationship("Leave", back_populates="staff")
    commissions = relationship("Commission", back_populates="staff")
    payrolls = relationship("Payroll", back_populates="staff")
    services = relationship("StaffService", back_populates="staff")
    appointments = relationship("Appointment", back_populates="staff")
    checkins = relationship("CheckIn", back_populates="staff")


class StaffSchedule(Base):
    __tablename__ = "StaffSchedules"

    ScheduleID = Column(Integer, primary_key=True, index=True)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), nullable=False)
    DayOfWeek = Column(Integer, nullable=False)
    StartTime = Column(Time, nullable=False)
    EndTime = Column(Time, nullable=False)
    IsWorking = Column(Boolean, nullable=False, default=True)
    BreakStart = Column(Time)
    BreakEnd = Column(Time)

    staff = relationship("Staff", back_populates="schedules")


class StaffAttendance(Base):
    __tablename__ = "StaffAttendance"

    AttendanceID = Column(Integer, primary_key=True, index=True)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), nullable=False)
    AttendanceDate = Column(Date, nullable=False)
    CheckInTime = Column(DateTime)
    CheckOutTime = Column(DateTime)
    Status = Column(String(50), nullable=False, default="Present")
    Notes = Column(String(500))
    MarkedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    staff = relationship("Staff", back_populates="attendance")


class Leave(Base):
    __tablename__ = "Leaves"

    LeaveID = Column(Integer, primary_key=True, index=True)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), nullable=False)
    LeaveType = Column(String(50), nullable=False)
    FromDate = Column(Date, nullable=False)
    ToDate = Column(Date, nullable=False)
    TotalDays = Column(Numeric(4, 1))
    Reason = Column(String(500))
    Status = Column(String(50), nullable=False, default="Pending")
    ApprovedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    ApprovedAt = Column(DateTime)
    RejectionReason = Column(String(500))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    staff = relationship("Staff", back_populates="leaves")


class Commission(Base):
    __tablename__ = "Commissions"

    CommissionID = Column(Integer, primary_key=True, index=True)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), nullable=False)
    InvoiceID = Column(Integer, nullable=False)
    InvoiceItemID = Column(Integer)
    BaseAmount = Column(Numeric(10, 2), nullable=False)
    CommissionPercent = Column(Numeric(5, 2), nullable=False)
    Amount = Column(Numeric(10, 2), nullable=False)
    Status = Column(String(50), nullable=False, default="Pending")
    PayrollID = Column(Integer)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    staff = relationship("Staff", back_populates="commissions")


class Payroll(Base):
    __tablename__ = "Payroll"

    PayrollID = Column(Integer, primary_key=True, index=True)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), nullable=False)
    PayPeriodStart = Column(Date, nullable=False)
    PayPeriodEnd = Column(Date, nullable=False)
    BaseSalary = Column(Numeric(10, 2), nullable=False, default=0)
    TotalCommission = Column(Numeric(10, 2), nullable=False, default=0)
    Bonus = Column(Numeric(10, 2), nullable=False, default=0)
    TotalDeductions = Column(Numeric(10, 2), nullable=False, default=0)
    NetPay = Column(Numeric(10, 2), nullable=False)
    WorkingDays = Column(Integer)
    PresentDays = Column(Integer)
    Status = Column(String(50), nullable=False, default="Pending")
    ProcessedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    ProcessedAt = Column(DateTime)
    Notes = Column(String)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    staff = relationship("Staff", back_populates="payrolls")
