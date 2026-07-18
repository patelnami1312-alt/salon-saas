import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import date
from pydantic import BaseModel

from app.core.database import get_async_db
from app.core.dependencies import get_salon_id, ReceptionistOrAbove
from app.models.billing import GiftCard, GiftCardTransaction
from app.models.user import User

router = APIRouter(prefix="/gift-cards", tags=["Gift Cards"])


def generate_code(length: int = 16) -> str:
    chars = string.ascii_uppercase + string.digits
    raw = ''.join(secrets.choice(chars) for _ in range(length))
    return '-'.join(raw[i:i+4] for i in range(0, length, 4))


class GiftCardCreate(BaseModel):
    amount: float
    purchased_by_customer_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    expiry_date: Optional[date] = None


class GiftCardRedeem(BaseModel):
    code: str
    invoice_id: int
    amount: float


@router.post("", status_code=status.HTTP_201_CREATED)
async def purchase_gift_card(
    data: GiftCardCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    code = generate_code()
    # Ensure uniqueness
    while (await db.execute(select(GiftCard).where(GiftCard.Code == code))).scalar_one_or_none():
        code = generate_code()

    card = GiftCard(
        SalonID=salon_id,
        Code=code,
        InitialAmount=data.amount,
        Balance=data.amount,
        PurchasedByCustomerID=data.purchased_by_customer_id,
        RecipientName=data.recipient_name,
        RecipientEmail=data.recipient_email,
        ExpiryDate=data.expiry_date,
    )
    db.add(card)
    await db.flush()

    db.add(GiftCardTransaction(
        GiftCardID=card.GiftCardID,
        Amount=data.amount,
        TransactionType="Purchase",
        BalanceAfter=data.amount,
    ))

    await db.commit()
    await db.refresh(card)
    return {"gift_card_id": card.GiftCardID, "code": card.Code, "balance": float(card.Balance)}


@router.get("")
async def list_gift_cards(
    salon_id: int = Depends(get_salon_id),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    query = select(GiftCard).where(GiftCard.SalonID == salon_id)
    if active_only:
        query = query.where(GiftCard.IsActive == True, GiftCard.Balance > 0)
    cards = (await db.execute(query.offset((page-1)*page_size).limit(page_size).order_by(GiftCard.CreatedAt.desc()))).scalars().all()
    return [
        {
            "gift_card_id": c.GiftCardID,
            "code": c.Code,
            "initial_amount": float(c.InitialAmount),
            "balance": float(c.Balance),
            "recipient_name": c.RecipientName,
            "recipient_email": c.RecipientEmail,
            "expiry_date": c.ExpiryDate,
            "is_active": c.IsActive,
            "purchased_at": c.PurchasedAt,
        }
        for c in cards
    ]


@router.get("/validate/{code}")
async def validate_gift_card(
    code: str,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    card = (await db.execute(
        select(GiftCard).where(GiftCard.Code == code.upper(), GiftCard.SalonID == salon_id)
    )).scalar_one_or_none()

    if not card:
        return {"is_valid": False, "message": "Gift card not found"}
    if not card.IsActive or float(card.Balance) <= 0:
        return {"is_valid": False, "message": "Gift card has no balance"}
    if card.ExpiryDate and card.ExpiryDate < date.today():
        return {"is_valid": False, "message": "Gift card expired"}

    return {
        "is_valid": True,
        "gift_card_id": card.GiftCardID,
        "balance": float(card.Balance),
        "recipient_name": card.RecipientName,
    }


@router.post("/redeem")
async def redeem_gift_card(
    data: GiftCardRedeem,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    card = (await db.execute(
        select(GiftCard).where(GiftCard.Code == data.code.upper(), GiftCard.SalonID == salon_id)
    )).scalar_one_or_none()

    if not card or not card.IsActive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift card not found or inactive")

    redeem_amount = min(data.amount, float(card.Balance))
    card.Balance -= redeem_amount
    if float(card.Balance) <= 0:
        card.IsActive = False

    db.add(GiftCardTransaction(
        GiftCardID=card.GiftCardID,
        InvoiceID=data.invoice_id,
        Amount=redeem_amount,
        TransactionType="Redeem",
        BalanceAfter=float(card.Balance),
    ))

    await db.commit()
    return {"redeemed_amount": redeem_amount, "remaining_balance": float(card.Balance)}
