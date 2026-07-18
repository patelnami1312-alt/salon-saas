from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, ForeignKey, func, Time
from sqlalchemy.orm import relationship
from app.core.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "SubscriptionPlans"

    PlanID = Column(Integer, primary_key=True, index=True)
    PlanName = Column(String(100), nullable=False)
    Price = Column(Numeric(10, 2), nullable=False, default=0)
    BillingCycle = Column(String(20), nullable=False, default="Monthly")
    MaxBranches = Column(Integer, nullable=False, default=1)
    MaxStaff = Column(Integer, nullable=False, default=10)
    MaxCustomers = Column(Integer, nullable=False, default=1000)
    Features = Column(String)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now())

    salons = relationship("Salon", back_populates="subscription_plan")
    subscriptions = relationship("SalonSubscription", back_populates="plan")


class Salon(Base):
    __tablename__ = "Salons"

    SalonID = Column(Integer, primary_key=True, index=True)
    SalonName = Column(String(200), nullable=False)
    OwnerName = Column(String(200))
    Email = Column(String(200), unique=True, nullable=False)
    Phone = Column(String(20))
    Address = Column(String(500))
    LogoURL = Column(String(500))
    Currency = Column(String(10), nullable=False, default="USD")
    Timezone = Column(String(100), nullable=False, default="America/New_York")
    SubscriptionPlanID = Column(Integer, ForeignKey("SubscriptionPlans.PlanID"))
    SubscriptionStatus = Column(String(50), nullable=False, default="Trial")
    TrialExpiryDate = Column(DateTime)
    IsActive = Column(Boolean, nullable=False, default=True)
    Settings = Column(String)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    subscription_plan = relationship("SubscriptionPlan", back_populates="salons")
    branches = relationship("Branch", back_populates="salon")
    users = relationship("User", back_populates="salon", foreign_keys="User.SalonID")
    customers = relationship("Customer", back_populates="salon")
    staff = relationship("Staff", back_populates="salon")
    services = relationship("Service", back_populates="salon")
    service_categories = relationship("ServiceCategory", back_populates="salon")
    subscriptions = relationship("SalonSubscription", back_populates="salon")
    campaigns = relationship("Campaign", back_populates="salon")


class Branch(Base):
    __tablename__ = "Branches"

    BranchID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False, index=True)
    BranchName = Column(String(200), nullable=False)
    BranchCode = Column(String(20), unique=True)
    Phone = Column(String(20))
    Email = Column(String(200))
    Address = Column(String(500))
    City = Column(String(100))
    State = Column(String(100))
    PostalCode = Column(String(20))
    Country = Column(String(100), default="India")
    Latitude = Column(Numeric(10, 8))
    Longitude = Column(Numeric(11, 8))
    OpeningTime = Column(Time)
    ClosingTime = Column(Time)
    WorkingDays = Column(String(100), default="1,2,3,4,5,6")
    SlotDuration = Column(Integer, nullable=False, default=30)
    MaxAdvanceBookingDays = Column(Integer, nullable=False, default=30)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    salon = relationship("Salon", back_populates="branches")
    users = relationship("User", back_populates="branch", foreign_keys="User.BranchID")
    staff = relationship("Staff", back_populates="branch")
    appointments = relationship("Appointment", back_populates="branch")
    checkins = relationship("CheckIn", back_populates="branch")
    invoices = relationship("Invoice", back_populates="branch")


class SalonSubscription(Base):
    __tablename__ = "SalonSubscriptions"

    SubscriptionID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    PlanID = Column(Integer, ForeignKey("SubscriptionPlans.PlanID"), nullable=False)
    StartDate = Column(Date, nullable=False)
    EndDate = Column(Date, nullable=False)
    Amount = Column(Numeric(10, 2), nullable=False)
    TransactionRef = Column(String(200))
    Status = Column(String(50), nullable=False, default="Active")
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    salon = relationship("Salon", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
