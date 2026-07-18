from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotificationTemplate(Base):
    __tablename__ = "NotificationTemplates"

    TemplateID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"))
    TemplateName = Column(String(200), nullable=False)
    Type = Column(String(50), nullable=False)
    Event = Column(String(100))
    Subject = Column(String(500))
    Body = Column(String, nullable=False)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())


class Notification(Base):
    __tablename__ = "Notifications"

    NotificationID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    RecipientType = Column(String(50), nullable=False)
    RecipientID = Column(Integer, nullable=False)
    Type = Column(String(50), nullable=False)
    Subject = Column(String(500))
    Message = Column(String, nullable=False)
    Status = Column(String(50), nullable=False, default="Pending", index=True)
    SentAt = Column(DateTime)
    ErrorMessage = Column(String(1000))
    RetryCount = Column(Integer, nullable=False, default=0)
    CreatedAt = Column(DateTime, nullable=False, default=func.now(), index=True)


class Campaign(Base):
    __tablename__ = "Campaigns"

    CampaignID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=False)
    CampaignName = Column(String(200), nullable=False)
    Type = Column(String(50), nullable=False)
    Subject = Column(String(500))
    Message = Column(String, nullable=False)
    TargetAudience = Column(String(100), nullable=False, default="All")
    FiltersJSON = Column(String)
    ScheduledAt = Column(DateTime)
    Status = Column(String(50), nullable=False, default="Draft")
    TotalRecipients = Column(Integer, nullable=False, default=0)
    SentCount = Column(Integer, nullable=False, default=0)
    FailedCount = Column(Integer, nullable=False, default=0)
    CreatedByUserID = Column(Integer, ForeignKey("Users.UserID"))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    salon = relationship("Salon", back_populates="campaigns")
