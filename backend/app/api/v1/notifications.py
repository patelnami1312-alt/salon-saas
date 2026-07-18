from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ManagerOrAbove
from app.models.notification import Notification, Campaign, NotificationTemplate
from app.models.customer import Customer
from app.models.user import User
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class CampaignCreate(BaseModel):
    campaign_name: str
    type: str  # SMS, Email, WhatsApp, Push
    subject: Optional[str] = None
    message: str
    target_audience: str = "All"
    filters_json: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class NotificationSend(BaseModel):
    recipient_type: str  # Customer, Staff, User
    recipient_id: int
    type: str
    subject: Optional[str] = None
    message: str


@router.get("")
async def list_notifications(
    salon_id: int = Depends(get_salon_id),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Notification).where(Notification.SalonID == salon_id)
    if status_filter:
        query = query.where(Notification.Status == status_filter)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    result = await db.execute(
        query.offset((page - 1) * page_size).limit(page_size).order_by(Notification.CreatedAt.desc())
    )
    notifications = result.scalars().all()

    return {
        "items": [
            {
                "notification_id": n.NotificationID,
                "recipient_type": n.RecipientType,
                "recipient_id": n.RecipientID,
                "type": n.Type,
                "subject": n.Subject,
                "status": n.Status,
                "sent_at": n.SentAt,
                "created_at": n.CreatedAt,
            }
            for n in notifications
        ],
        "total": total,
    }


@router.post("/send")
async def send_notification(
    data: NotificationSend,
    background_tasks: BackgroundTasks,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    notification = Notification(
        SalonID=salon_id,
        RecipientType=data.recipient_type,
        RecipientID=data.recipient_id,
        Type=data.type,
        Subject=data.subject,
        Message=data.message,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    background_tasks.add_task(
        _send_notification_task, notification.NotificationID, data, db
    )

    return {"notification_id": notification.NotificationID, "message": "Notification queued"}


@router.get("/campaigns")
async def list_campaigns(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    result = await db.execute(
        select(Campaign).where(Campaign.SalonID == salon_id).order_by(Campaign.CreatedAt.desc())
    )
    campaigns = result.scalars().all()
    return [
        {
            "campaign_id": c.CampaignID,
            "campaign_name": c.CampaignName,
            "type": c.Type,
            "target_audience": c.TargetAudience,
            "status": c.Status,
            "scheduled_at": c.ScheduledAt,
            "sent_count": c.SentCount,
            "total_recipients": c.TotalRecipients,
        }
        for c in campaigns
    ]


@router.post("/campaigns")
async def create_campaign(
    data: CampaignCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    recipients_count = await _count_recipients(salon_id, data.target_audience, db)

    campaign = Campaign(
        SalonID=salon_id,
        CampaignName=data.campaign_name,
        Type=data.type,
        Subject=data.subject,
        Message=data.message,
        TargetAudience=data.target_audience,
        FiltersJSON=data.filters_json,
        ScheduledAt=data.scheduled_at,
        Status="Scheduled" if data.scheduled_at else "Draft",
        TotalRecipients=recipients_count,
        CreatedByUserID=current_user.UserID,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return {"campaign_id": campaign.CampaignID, "total_recipients": recipients_count}


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    campaign = (await db.execute(
        select(Campaign).where(Campaign.CampaignID == campaign_id, Campaign.SalonID == salon_id)
    )).scalar_one_or_none()

    if not campaign:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    campaign.Status = "Running"
    await db.commit()

    background_tasks.add_task(_execute_campaign, campaign_id, salon_id, db)
    return {"message": "Campaign sending started", "campaign_id": campaign_id}


async def _count_recipients(salon_id: int, target: str, db: AsyncSession) -> int:
    if target == "All":
        return (await db.execute(
            select(func.count()).where(Customer.SalonID == salon_id, Customer.IsActive == True)
        )).scalar() or 0
    return 0


async def _send_notification_task(notification_id: int, data: NotificationSend, db: AsyncSession):
    pass


async def _execute_campaign(campaign_id: int, salon_id: int, db: AsyncSession):
    pass
