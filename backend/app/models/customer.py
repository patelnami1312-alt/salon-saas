from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Customer(Base):
    __tablename__ = "Customers"

    CustomerID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False, index=True)
    FirstName = Column(String(100), nullable=False)
    LastName = Column(String(100), nullable=False)
    Gender = Column(String(20))
    DateOfBirth = Column(Date)
    Mobile = Column(String(20), nullable=False, index=True)
    Email = Column(String(200), index=True)
    Address = Column(String(500))
    City = Column(String(100))
    ProfilePictureURL = Column(String(500))
    Notes = Column(String)
    Preferences = Column(String)
    LoyaltyPoints = Column(Integer, nullable=False, default=0)
    WalletBalance = Column(Numeric(10, 2), nullable=False, default=0)
    ReferralCode = Column(String(50), unique=True, index=True)
    ReferredByID = Column(Integer, ForeignKey("Customers.CustomerID"))
    TotalVisits = Column(Integer, nullable=False, default=0)
    TotalSpent = Column(Numeric(10, 2), nullable=False, default=0)
    LastVisitDate = Column(Date)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    salon = relationship("Salon", back_populates="customers")
    auth = relationship("CustomerAuth", back_populates="customer", uselist=False)
    memberships = relationship("CustomerMembership", back_populates="customer")
    reviews = relationship("CustomerReview", back_populates="customer")
    loyalty_transactions = relationship("LoyaltyTransaction", back_populates="customer")
    wallet_transactions = relationship("WalletTransaction", back_populates="customer")
    appointments = relationship("Appointment", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
    referred_by = relationship("Customer", remote_side="Customer.CustomerID")

    @property
    def full_name(self) -> str:
        return f"{self.FirstName} {self.LastName}"


class CustomerAuth(Base):
    __tablename__ = "CustomerAuth"

    AuthID = Column(Integer, primary_key=True, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False, unique=True)
    PasswordHash = Column(String(255), nullable=False)
    IsEmailVerified = Column(Boolean, nullable=False, default=False)
    OTPCode = Column(String(10))
    OTPExpiry = Column(DateTime)
    LastLoginAt = Column(DateTime)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    customer = relationship("Customer", back_populates="auth")


class MembershipPlan(Base):
    __tablename__ = "MembershipPlans"

    PlanID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    PlanName = Column(String(200), nullable=False)
    Description = Column(String)
    Price = Column(Numeric(10, 2), nullable=False)
    DurationDays = Column(Integer, nullable=False, default=30)
    DiscountPercent = Column(Numeric(5, 2), nullable=False, default=0)
    LoyaltyBonus = Column(Integer, nullable=False, default=0)
    Benefits = Column(String)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    memberships = relationship("CustomerMembership", back_populates="plan")


class CustomerMembership(Base):
    __tablename__ = "CustomerMemberships"

    MembershipID = Column(Integer, primary_key=True, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    PlanID = Column(Integer, ForeignKey("MembershipPlans.PlanID"), nullable=False)
    StartDate = Column(Date, nullable=False)
    EndDate = Column(Date, nullable=False)
    Status = Column(String(50), nullable=False, default="Active")
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    customer = relationship("Customer", back_populates="memberships")
    plan = relationship("MembershipPlan", back_populates="memberships")


class CustomerReview(Base):
    __tablename__ = "CustomerReviews"

    ReviewID = Column(Integer, primary_key=True, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False)
    AppointmentID = Column(Integer)
    StaffID = Column(Integer)
    Rating = Column(Integer, nullable=False)
    Review = Column(String)
    IsPublic = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    customer = relationship("Customer", back_populates="reviews")


class LoyaltyTransaction(Base):
    __tablename__ = "LoyaltyTransactions"

    TransactionID = Column(Integer, primary_key=True, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    InvoiceID = Column(Integer)
    Points = Column(Integer, nullable=False)
    TransactionType = Column(String(50), nullable=False)
    Description = Column(String(500))
    BalanceAfter = Column(Integer, nullable=False)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    customer = relationship("Customer", back_populates="loyalty_transactions")


class WalletTransaction(Base):
    __tablename__ = "WalletTransactions"

    TransactionID = Column(Integer, primary_key=True, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    Amount = Column(Numeric(10, 2), nullable=False)
    TransactionType = Column(String(50), nullable=False)
    Description = Column(String(500))
    BalanceAfter = Column(Numeric(10, 2), nullable=False)
    InvoiceID = Column(Integer)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    customer = relationship("Customer", back_populates="wallet_transactions")
