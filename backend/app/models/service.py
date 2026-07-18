from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ServiceCategory(Base):
    __tablename__ = "ServiceCategories"

    CategoryID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    CategoryName = Column(String(100), nullable=False)
    Description = Column(String(500))
    IconURL = Column(String(500))
    ColorCode = Column(String(20))
    SortOrder = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    salon = relationship("Salon", back_populates="service_categories")
    services = relationship("Service", back_populates="category")


class Service(Base):
    __tablename__ = "Services"

    ServiceID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False, index=True)
    CategoryID = Column(Integer, ForeignKey("ServiceCategories.CategoryID"), nullable=False)
    ServiceName = Column(String(200), nullable=False)
    Description = Column(String)
    Duration = Column(Integer, nullable=False)
    Price = Column(Numeric(10, 2), nullable=False)
    TaxPercent = Column(Numeric(5, 2), nullable=False, default=0)
    GenderType = Column(String(20), nullable=False, default="Unisex")
    ImageURL = Column(String(500))
    ColorCode = Column(String(20))
    SortOrder = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    salon = relationship("Salon", back_populates="services")
    category = relationship("ServiceCategory", back_populates="services")
    addons = relationship("ServiceAddon", back_populates="service")
    staff_services = relationship("StaffService", back_populates="service")
    appointments = relationship("Appointment", back_populates="service")
    checkins = relationship("CheckIn", back_populates="service")


class ServiceAddon(Base):
    __tablename__ = "ServiceAddons"

    AddonID = Column(Integer, primary_key=True, index=True)
    ServiceID = Column(Integer, ForeignKey("Services.ServiceID"), nullable=False)
    AddonName = Column(String(200), nullable=False)
    Price = Column(Numeric(10, 2), nullable=False)
    Duration = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)

    service = relationship("Service", back_populates="addons")


class StaffService(Base):
    __tablename__ = "StaffServices"

    StaffID = Column(Integer, ForeignKey("Staff.StaffID"), primary_key=True)
    ServiceID = Column(Integer, ForeignKey("Services.ServiceID"), primary_key=True)

    staff = relationship("Staff", back_populates="services")
    service = relationship("Service", back_populates="staff_services")


class ServicePackage(Base):
    __tablename__ = "ServicePackages"

    PackageID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    PackageName = Column(String(200), nullable=False)
    Description = Column(String)
    OriginalPrice = Column(Numeric(10, 2), nullable=False)
    PackagePrice = Column(Numeric(10, 2), nullable=False)
    ValidityDays = Column(Integer, nullable=False, default=30)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    package_services = relationship("PackageService", back_populates="package")


class PackageService(Base):
    __tablename__ = "PackageServices"

    PackageID = Column(Integer, ForeignKey("ServicePackages.PackageID"), primary_key=True)
    ServiceID = Column(Integer, ForeignKey("Services.ServiceID"), primary_key=True)
    Quantity = Column(Integer, nullable=False, default=1)

    package = relationship("ServicePackage", back_populates="package_services")
    service = relationship("Service")
