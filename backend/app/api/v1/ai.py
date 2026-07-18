"""AI-powered features using Anthropic Claude."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_async_db
from app.core.dependencies import get_salon_id, ManagerOrAbove
from app.core.config import settings
from app.models.appointment import Appointment
from app.models.customer import Customer, LoyaltyTransaction
from app.models.billing import Invoice
from app.models.service import Service
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI Features"])


def get_claude_client():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features require ANTHROPIC_API_KEY in backend .env",
        )
    import anthropic
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


class AppointmentAssistRequest(BaseModel):
    customer_name: Optional[str] = None
    customer_history: Optional[str] = None
    preferred_services: Optional[str] = None
    date_preference: Optional[str] = None
    special_requests: Optional[str] = None


class CampaignRequest(BaseModel):
    campaign_type: str  # retention, promo, birthday, reactivation
    target_segment: Optional[str] = None
    offer_details: Optional[str] = None
    tone: Optional[str] = "friendly"


class RetentionAlertRequest(BaseModel):
    days_inactive: int = 30
    limit: int = 20


@router.post("/appointment-assist")
async def appointment_assistant(
    data: AppointmentAssistRequest,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    services = (await db.execute(
        select(Service).where(Service.SalonID == salon_id, Service.IsActive == True)
    )).scalars().all()
    service_list = ", ".join(f"{s.ServiceName} (${float(s.Price):.0f}, {s.Duration}min)" for s in services[:20])

    client = get_claude_client()
    prompt = f"""You are a helpful salon appointment assistant for a luxury beauty salon.

Available services: {service_list}

Customer request:
- Name: {data.customer_name or 'Walk-in'}
- History: {data.customer_history or 'New customer'}
- Preferred services: {data.preferred_services or 'Not specified'}
- Date preference: {data.date_preference or 'Flexible'}
- Special requests: {data.special_requests or 'None'}

Provide a friendly, helpful response that:
1. Recommends 2-3 suitable services based on the customer's needs
2. Estimates total time and price
3. Suggests optimal booking time
4. Mentions any relevant tips or preparation advice

Keep the response concise (under 200 words) and warm in tone."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"suggestion": message.content[0].text}


@router.post("/generate-campaign")
async def generate_campaign(
    data: CampaignRequest,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    client = get_claude_client()

    type_prompts = {
        "retention": "bring back customers who haven't visited in a while",
        "promo": "promote a special service or offer",
        "birthday": "wish customers happy birthday with a special discount",
        "reactivation": "re-engage lapsed customers with an irresistible offer",
    }
    purpose = type_prompts.get(data.campaign_type, data.campaign_type)

    prompt = f"""Generate a marketing campaign message for a luxury beauty salon.

Campaign type: {data.campaign_type} — {purpose}
Target segment: {data.target_segment or 'All customers'}
Offer details: {data.offer_details or 'Standard salon services'}
Tone: {data.tone}

Create:
1. A catchy subject line (under 60 characters)
2. A short SMS message (under 160 characters)
3. A longer email body (150-200 words)
4. A call-to-action button text

Format your response as JSON with keys: subject_line, sms_message, email_body, cta_text"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = message.content[0].text
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        campaign_data = json.loads(text[start:end])
    except Exception:
        campaign_data = {"raw_response": text}

    return {"campaign": campaign_data}


@router.get("/retention-alerts")
async def retention_alerts(
    salon_id: int = Depends(get_salon_id),
    days_inactive: int = 30,
    limit: int = 20,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    cutoff = date.today() - timedelta(days=days_inactive)
    at_risk = (await db.execute(
        select(Customer)
        .where(
            Customer.SalonID == salon_id,
            Customer.IsActive == True,
            Customer.LastVisitDate != None,
            Customer.LastVisitDate < cutoff,
            Customer.TotalVisits > 1,
        )
        .order_by(Customer.TotalSpent.desc())
        .limit(limit)
    )).scalars().all()

    customers_data = [
        {
            "customer_id": c.CustomerID,
            "name": f"{c.FirstName} {c.LastName}",
            "mobile": c.Mobile,
            "email": c.Email,
            "last_visit": str(c.LastVisitDate),
            "days_since_visit": (date.today() - c.LastVisitDate).days,
            "total_visits": c.TotalVisits,
            "total_spent": float(c.TotalSpent),
            "loyalty_points": c.LoyaltyPoints,
        }
        for c in at_risk
    ]

    if not customers_data:
        return {"at_risk_customers": [], "ai_insight": "No at-risk customers found for this period."}

    client = get_claude_client()
    summary_lines = "\n".join(
        f"- {c['name']}: last visit {c['days_since_visit']} days ago, {c['total_visits']} visits, ${c['total_spent']:.0f} spent"
        for c in customers_data[:10]
    )

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": f"""Analyze these at-risk salon customers and provide a brief insight (3-4 sentences) on:
1. The retention risk pattern you see
2. The most valuable segment to target first
3. One specific action to win them back

Customer data:
{summary_lines}"""
        }],
    )

    return {
        "at_risk_customers": customers_data,
        "ai_insight": message.content[0].text,
        "total_at_risk": len(customers_data),
    }


@router.post("/smart-schedule")
async def smart_schedule_suggestion(
    date_requested: date,
    branch_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    appts = (await db.execute(
        select(Appointment).where(
            Appointment.SalonID == salon_id,
            Appointment.BranchID == branch_id,
            Appointment.AppointmentDate == date_requested,
            Appointment.Status.notin_(["Cancelled"]),
        )
    )).scalars().all()

    total = len(appts)
    hours = {}
    for a in appts:
        if a.StartTime:
            h = a.StartTime.hour
            hours[h] = hours.get(h, 0) + 1

    peak_hour = max(hours, key=hours.get) if hours else 10
    low_hour = min(hours, key=hours.get) if len(hours) > 2 else (peak_hour + 4) % 12 + 8

    client = get_claude_client()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=250,
        messages=[{
            "role": "user",
            "content": f"""A beauty salon has {total} appointments scheduled for {date_requested}.
Peak hour: {peak_hour}:00. Quietest hour: {low_hour}:00.
Hourly distribution: {hours}

In 3-4 sentences, give the salon manager:
1. A staffing recommendation for this day
2. The best time to schedule walk-ins or promotions
3. One operational tip to maximize revenue"""
        }],
    )

    return {
        "date": str(date_requested),
        "total_appointments": total,
        "peak_hour": f"{peak_hour}:00",
        "low_hour": f"{low_hour}:00",
        "ai_suggestion": message.content[0].text,
    }
