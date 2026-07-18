from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, ForeignKey, func, Time
from sqlalchemy.orm import relationship
from app.core.database import Base


class Appointment(Base):
    __tablename__ = "Appointments"

    AppointmentID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False, index=True)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), index=True)
    ServiceID = Column(Integer, ForeignKey("Services.ServiceID"), nullable=False)
    AppointmentDate = Column(Date, nullable=False, index=True)
    StartTime = Column(Time, nullable=False)
    EndTime = Column(Time, nullable=False)
    Status = Column(String(50), nullable=False, default="Scheduled", index=True)
    Notes = Column(String)
    CancellationReason = Column(String(500))
    RescheduledFromID = Column(Integer, ForeignKey("Appointments.AppointmentID"))
    BookingSource = Column(String(50), nullable=False, default="Online")
    ServiceAmount = Column(Numeric(10, 2))
    ReminderSent = Column(Boolean, nullable=False, default=False)
    Reminder24hSent = Column(Boolean, nullable=False, default=False)
    Reminder1hSent = Column(Boolean, nullable=False, default=False)
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    branch = relationship("Branch", back_populates="appointments")
    customer = relationship("Customer", back_populates="appointments")
    staff = relationship("Staff", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")
    addons = relationship("AppointmentAddon", back_populates="appointment")
    checkin = relationship("CheckIn", back_populates="appointment", uselist=False)
    invoice = relationship("Invoice", back_populates="appointment", uselist=False)


class AppointmentAddon(Base):
    __tablename__ = "AppointmentAddons"

    ID = Column(Integer, primary_key=True, index=True)
    AppointmentID = Column(Integer, ForeignKey("Appointments.AppointmentID"), nullable=False)
    AddonID = Column(Integer, ForeignKey("ServiceAddons.AddonID"), nullable=False)
    Price = Column(Numeric(10, 2), nullable=False)

    appointment = relationship("Appointment", back_populates="addons")
    addon = relationship("ServiceAddon")


class Waitlist(Base):
    __tablename__ = "Waitlist"

    WaitlistID = Column(Integer, primary_key=True, index=True)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    ServiceID = Column(Integer, ForeignKey("Services.ServiceID"), nullable=False)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"))
    PreferredDate = Column(Date)
    PreferredTime = Column(Time)
    Status = Column(String(50), nullable=False, default="Waiting")
    Notes = Column(String(500))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    customer = relationship("Customer")
    service = relationship("Service")
    staff = relationship("Staff")
