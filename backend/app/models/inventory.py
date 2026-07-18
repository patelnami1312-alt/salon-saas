from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Numeric, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Supplier(Base):
    __tablename__ = "Suppliers"

    SupplierID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    SupplierName = Column(String(200), nullable=False)
    ContactPerson = Column(String(200))
    Email = Column(String(200))
    Phone = Column(String(20))
    Address = Column(String(500))
    GSTIN = Column(String(50))
    PaymentTerms = Column(String(200))
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    products = relationship("Product", back_populates="supplier")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")


class ProductCategory(Base):
    __tablename__ = "ProductCategories"

    CategoryID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    CategoryName = Column(String(100), nullable=False)
    Description = Column(String(500))
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "Products"

    ProductID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    CategoryID = Column(Integer, ForeignKey("ProductCategories.CategoryID"), nullable=False)
    SupplierID = Column(Integer, ForeignKey("Suppliers.SupplierID"))
    ProductName = Column(String(200), nullable=False)
    SKU = Column(String(100), unique=True)
    Barcode = Column(String(100))
    Description = Column(String)
    CostPrice = Column(Numeric(10, 2), nullable=False, default=0)
    SalePrice = Column(Numeric(10, 2), nullable=False, default=0)
    TaxPercent = Column(Numeric(5, 2), nullable=False, default=0)
    Unit = Column(String(50))
    HSNCode = Column(String(20))
    ImageURL = Column(String(500))
    IsForSale = Column(Boolean, nullable=False, default=True)
    IsForUse = Column(Boolean, nullable=False, default=True)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    category = relationship("ProductCategory", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    inventory_records = relationship("Inventory", back_populates="product")
    purchase_order_items = relationship("PurchaseOrderItem", back_populates="product")


class Inventory(Base):
    __tablename__ = "Inventory"

    InventoryID = Column(Integer, primary_key=True, index=True)
    ProductID = Column(Integer, ForeignKey("Products.ProductID"), nullable=False)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False)
    CurrentStock = Column(Numeric(10, 2), nullable=False, default=0)
    MinStockLevel = Column(Numeric(10, 2), nullable=False, default=0)
    MaxStockLevel = Column(Numeric(10, 2))
    ReorderPoint = Column(Numeric(10, 2), nullable=False, default=0)
    LastRestockedAt = Column(DateTime)
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="inventory_records")
    transactions = relationship("StockTransaction", back_populates="inventory")


class PurchaseOrder(Base):
    __tablename__ = "PurchaseOrders"

    POID = Column(Integer, primary_key=True, index=True)
    PONumber = Column(String(50), unique=True, nullable=False)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=False)
    SupplierID = Column(Integer, ForeignKey("Suppliers.SupplierID"), nullable=False)
    OrderDate = Column(Date, nullable=False)
    ExpectedDate = Column(Date)
    ReceivedDate = Column(Date)
    SubTotal = Column(Numeric(10, 2), nullable=False, default=0)
    TaxAmount = Column(Numeric(10, 2), nullable=False, default=0)
    TotalAmount = Column(Numeric(10, 2), nullable=False, default=0)
    Status = Column(String(50), nullable=False, default="Draft")
    Notes = Column(String)
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")
    stock_transactions = relationship("StockTransaction", back_populates="purchase_order")


class PurchaseOrderItem(Base):
    __tablename__ = "PurchaseOrderItems"

    ItemID = Column(Integer, primary_key=True, index=True)
    POID = Column(Integer, ForeignKey("PurchaseOrders.POID"), nullable=False)
    ProductID = Column(Integer, ForeignKey("Products.ProductID"), nullable=False)
    OrderedQuantity = Column(Numeric(10, 2), nullable=False)
    ReceivedQuantity = Column(Numeric(10, 2), nullable=False, default=0)
    UnitPrice = Column(Numeric(10, 2), nullable=False)
    TaxPercent = Column(Numeric(5, 2), nullable=False, default=0)
    TotalPrice = Column(Numeric(10, 2), nullable=False)

    order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product", back_populates="purchase_order_items")


class StockTransaction(Base):
    __tablename__ = "StockTransactions"

    TransactionID = Column(Integer, primary_key=True, index=True)
    InventoryID = Column(Integer, ForeignKey("Inventory.InventoryID"), nullable=False)
    TransactionType = Column(String(50), nullable=False)
    Quantity = Column(Numeric(10, 2), nullable=False)
    BalanceBefore = Column(Numeric(10, 2), nullable=False)
    BalanceAfter = Column(Numeric(10, 2), nullable=False)
    Notes = Column(String(500))
    POID = Column(Integer, ForeignKey("PurchaseOrders.POID"))
    InvoiceID = Column(Integer, ForeignKey("Invoices.InvoiceID"))
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    inventory = relationship("Inventory", back_populates="transactions")
    purchase_order = relationship("PurchaseOrder", back_populates="stock_transactions")
