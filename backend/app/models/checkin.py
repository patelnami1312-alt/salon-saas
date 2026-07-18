from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CheckIn(Base):
    __tablename__ = "CheckIns"

    CheckInID = Column(Integer, primary_key=True, index=True)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    AppointmentID = Column(Integer, ForeignKey("Appointments.AppointmentID"))
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), index=True)
    ServiceID = Column(Integer, ForeignKey("Services.ServiceID"), nullable=False)
    QueueNumber = Column(Integer)
    CheckInTime = Column(DateTime, nullable=False, default=func.now())
    StartServiceTime = Column(DateTime)
    EndServiceTime = Column(DateTime)
    Status = Column(String(50), nullable=False, default="Waiting", index=True)
    Notes = Column(String(500))
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    branch = relationship("Branch", back_populates="checkins")
    customer = relationship("Customer")
    appointment = relationship("Appointment", back_populates="checkin")
    staff = relationship("Staff", back_populates="checkins")
    service = relationship("Service", back_populates="checkins")
    invoice = relationship("Invoice", back_populates="checkin", uselist=False)
