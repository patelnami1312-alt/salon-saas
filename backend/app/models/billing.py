from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Coupon(Base):
    __tablename__ = "Coupons"

    CouponID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    CouponCode = Column(String(50), unique=True, nullable=False, index=True)
    Description = Column(String(200))
    DiscountType = Column(String(20), nullable=False)
    DiscountValue = Column(Numeric(10, 2), nullable=False)
    MinOrderAmount = Column(Numeric(10, 2), nullable=False, default=0)
    MaxDiscount = Column(Numeric(10, 2))
    MaxUses = Column(Integer)
    UsedCount = Column(Integer, nullable=False, default=0)
    ValidFrom = Column(DateTime)
    ValidUntil = Column(DateTime)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    invoices = relationship("Invoice", back_populates="coupon")


class Invoice(Base):
    __tablename__ = "Invoices"

    InvoiceID = Column(Integer, primary_key=True, index=True)
    InvoiceNumber = Column(String(50), unique=True, nullable=False, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False, index=True)
    AppointmentID = Column(Integer, ForeignKey("Appointments.AppointmentID"))
    CheckInID = Column(Integer, ForeignKey("CheckIns.CheckInID"))
    SubTotal = Column(Numeric(10, 2), nullable=False)
    TaxAmount = Column(Numeric(10, 2), nullable=False, default=0)
    DiscountAmount = Column(Numeric(10, 2), nullable=False, default=0)
    CouponID = Column(Integer, ForeignKey("Coupons.CouponID"))
    WalletUsed = Column(Numeric(10, 2), nullable=False, default=0)
    LoyaltyUsed = Column(Integer, nullable=False, default=0)
    TotalAmount = Column(Numeric(10, 2), nullable=False)
    PaidAmount = Column(Numeric(10, 2), nullable=False, default=0)
    BalanceAmount = Column(Numeric(10, 2), nullable=False, default=0)
    Status = Column(String(50), nullable=False, default="Pending", index=True)
    Notes = Column(String(500))
    PrintedCount = Column(Integer, nullable=False, default=0)
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now(), index=True)
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    branch = relationship("Branch", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    appointment = relationship("Appointment", back_populates="invoice")
    checkin = relationship("CheckIn", back_populates="invoice")
    coupon = relationship("Coupon", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "InvoiceItems"

    ItemID = Column(Integer, primary_key=True, index=True)
    InvoiceID = Column(Integer, ForeignKey("Invoices.InvoiceID"), nullable=False)
    ItemType = Column(String(50), nullable=False)
    ItemRefID = Column(Integer)
    ItemName = Column(String(200), nullable=False)
    Quantity = Column(Integer, nullable=False, default=1)
    UnitPrice = Column(Numeric(10, 2), nullable=False)
    TaxPercent = Column(Numeric(5, 2), nullable=False, default=0)
    TaxAmount = Column(Numeric(10, 2), nullable=False, default=0)
    DiscountPercent = Column(Numeric(5, 2), nullable=False, default=0)
    DiscountAmount = Column(Numeric(10, 2), nullable=False, default=0)
    TotalPrice = Column(Numeric(10, 2), nullable=False)
    StaffID = Column(Integer, ForeignKey("Staff.StaffID"))

    invoice = relationship("Invoice", back_populates="items")
    staff = relationship("Staff")


class Payment(Base):
    __tablename__ = "Payments"

    PaymentID = Column(Integer, primary_key=True, index=True)
    InvoiceID = Column(Integer, ForeignKey("Invoices.InvoiceID"), nullable=False)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"), nullable=False)
    PaymentMethod = Column(String(50), nullable=False)
    Amount = Column(Numeric(10, 2), nullable=False)
    TransactionID = Column(String(200))
    GatewayResponse = Column(String)
    Status = Column(String(50), nullable=False, default="Success")
    Notes = Column(String(500))
    RefundedAmount = Column(Numeric(10, 2), nullable=False, default=0)
    RefundedAt = Column(DateTime)
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    invoice = relationship("Invoice", back_populates="payments")


class GiftCard(Base):
    __tablename__ = "GiftCards"

    GiftCardID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    Code = Column(String(50), unique=True, nullable=False, index=True)
    InitialAmount = Column(Numeric(10, 2), nullable=False)
    Balance = Column(Numeric(10, 2), nullable=False)
    PurchasedByCustomerID = Column(Integer, ForeignKey("Customers.CustomerID"))
    RecipientName = Column(String(200))
    RecipientEmail = Column(String(200))
    ExpiryDate = Column(Date)
    IsActive = Column(Boolean, nullable=False, default=True)
    PurchasedAt = Column(DateTime, nullable=False, default=func.now())
    CreatedAt = Column(DateTime, nullable=False, default=func.now())


class GiftCardTransaction(Base):
    __tablename__ = "GiftCardTransactions"

    TransactionID = Column(Integer, primary_key=True, index=True)
    GiftCardID = Column(Integer, ForeignKey("GiftCards.GiftCardID"), nullable=False)
    InvoiceID = Column(Integer, ForeignKey("Invoices.InvoiceID"))
    Amount = Column(Numeric(10, 2), nullable=False)
    TransactionType = Column(String(50), nullable=False)  # Purchase, Redeem
    BalanceAfter = Column(Numeric(10, 2), nullable=False)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
