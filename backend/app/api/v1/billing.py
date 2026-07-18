from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime
from decimal import Decimal
import math
import uuid

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ReceptionistOrAbove
from app.models.billing import Invoice, InvoiceItem, Payment, Coupon
from app.models.customer import Customer, LoyaltyTransaction, WalletTransaction
from app.models.salon import Salon
from app.models.user import User
from app.schemas.billing import (
    InvoiceCreate, PaymentCreate, RefundCreate,
    CouponCreate, CouponValidateRequest, CouponValidateResponse,
    TerminalInitiateRequest, TerminalInitiateResponse, TerminalStatusResponse,
    StripeIntentRequest, StripeIntentResponse,
)
from app.services.terminal_service import (
    initiate_payment, get_payment_status, generate_merchant_txn_id,
)
from app.services.stripe_gateway import create_payment_intent as stripe_create_payment_intent
from app.services.payment_ledger import apply_payment
from app.core.config import settings

router = APIRouter(prefix="/billing", tags=["Billing & POS"])


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    sub_total = sum(
        float(item.unit_price) * item.quantity * (1 - float(item.discount_percent) / 100)
        for item in data.items
    )
    tax_total = sum(
        float(item.unit_price) * item.quantity * float(item.tax_percent) / 100
        for item in data.items
    )
    discount_total = sum(
        float(item.unit_price) * item.quantity * float(item.discount_percent) / 100
        for item in data.items
    )

    coupon_discount = 0.0
    coupon_id = None
    if data.coupon_code:
        coupon = (await db.execute(
            select(Coupon).where(Coupon.CouponCode == data.coupon_code, Coupon.IsActive == True)
        )).scalar_one_or_none()
        if coupon:
            if float(sub_total) >= float(coupon.MinOrderAmount):
                if coupon.DiscountType == "Percent":
                    coupon_discount = float(sub_total) * float(coupon.DiscountValue) / 100
                    if coupon.MaxDiscount:
                        coupon_discount = min(coupon_discount, float(coupon.MaxDiscount))
                else:
                    coupon_discount = float(coupon.DiscountValue)
                coupon.UsedCount += 1
                coupon_id = coupon.CouponID

    wallet_used = 0.0
    loyalty_used = 0
    customer = None
    if data.customer_id:
        customer = (await db.execute(select(Customer).where(Customer.CustomerID == data.customer_id))).scalar_one_or_none()

    if data.wallet_amount and customer and float(customer.WalletBalance) >= float(data.wallet_amount):
        wallet_used = float(data.wallet_amount)
        customer.WalletBalance -= Decimal(str(round(wallet_used, 2)))
        db.add(WalletTransaction(
            CustomerID=data.customer_id,
            Amount=-wallet_used,
            TransactionType="Debit",
            Description="Invoice payment",
            BalanceAfter=customer.WalletBalance,
        ))

    if data.loyalty_points and customer and customer.LoyaltyPoints >= data.loyalty_points:
        loyalty_used = data.loyalty_points
        loyalty_discount = loyalty_used * settings.LOYALTY_REDEEM_RATE
        coupon_discount += loyalty_discount
        customer.LoyaltyPoints -= loyalty_used

    total = sub_total + tax_total - discount_total - coupon_discount - wallet_used
    total = max(0, total)

    invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    invoice = Invoice(
        InvoiceNumber=invoice_number,
        SalonID=salon_id,
        BranchID=data.branch_id,
        CustomerID=data.customer_id,
        AppointmentID=data.appointment_id,
        CheckInID=data.checkin_id,
        SubTotal=sub_total,
        TaxAmount=tax_total,
        DiscountAmount=discount_total + coupon_discount,
        CouponID=coupon_id,
        WalletUsed=wallet_used,
        LoyaltyUsed=loyalty_used,
        TotalAmount=total,
        PaidAmount=0,
        BalanceAmount=total,
        Notes=data.notes,
        CreatedByUserID=current_user.UserID,
    )
    db.add(invoice)
    await db.flush()

    for item in data.items:
        unit = float(item.unit_price)
        tax = unit * item.quantity * float(item.tax_percent) / 100
        disc = unit * item.quantity * float(item.discount_percent) / 100
        total_price = unit * item.quantity + tax - disc

        db_item = InvoiceItem(
            InvoiceID=invoice.InvoiceID,
            ItemType=item.item_type,
            ItemRefID=item.item_ref_id,
            ItemName=item.item_name,
            Quantity=item.quantity,
            UnitPrice=unit,
            TaxPercent=item.tax_percent,
            TaxAmount=tax,
            DiscountPercent=item.discount_percent,
            DiscountAmount=disc,
            TotalPrice=total_price,
            StaffID=item.staff_id,
        )
        db.add(db_item)

    if customer:
        loyalty_earned = int(float(total) * settings.LOYALTY_POINTS_PER_CURRENCY)
        if loyalty_earned > 0:
            customer.LoyaltyPoints += loyalty_earned
            customer.TotalSpent += Decimal(str(round(total, 2)))
            db.add(LoyaltyTransaction(
                CustomerID=data.customer_id,
                Points=loyalty_earned,
                TransactionType="Earned",
                Description=f"Invoice {invoice_number}",
                BalanceAfter=customer.LoyaltyPoints,
            ))

    await db.commit()
    await db.refresh(invoice)
    return {"invoice_id": invoice.InvoiceID, "invoice_number": invoice_number, "total_amount": float(total)}


@router.get("/invoices")
async def list_invoices(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    query = select(Invoice).where(Invoice.SalonID == salon_id)
    if branch_id:
        query = query.where(Invoice.BranchID == branch_id)
    if customer_id:
        query = query.where(Invoice.CustomerID == customer_id)
    if status_filter:
        query = query.where(Invoice.Status == status_filter)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Invoice.CreatedAt.desc())
    result = await db.execute(query)
    invoices = result.scalars().all()

    return {
        "items": [
            {
                "invoice_id": i.InvoiceID,
                "invoice_number": i.InvoiceNumber,
                "customer_id": i.CustomerID,
                "total_amount": float(i.TotalAmount),
                "paid_amount": float(i.PaidAmount),
                "balance_amount": float(i.BalanceAmount),
                "status": i.Status,
                "created_at": i.CreatedAt,
            }
            for i in invoices
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    result = await db.execute(
        select(Invoice).where(Invoice.InvoiceID == invoice_id, Invoice.SalonID == salon_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    customer = None
    if invoice.CustomerID:
        customer = (await db.execute(select(Customer).where(Customer.CustomerID == invoice.CustomerID))).scalar_one_or_none()

    items_result = await db.execute(select(InvoiceItem).where(InvoiceItem.InvoiceID == invoice_id))
    items = items_result.scalars().all()

    payments_result = await db.execute(select(Payment).where(Payment.InvoiceID == invoice_id))
    payments = payments_result.scalars().all()

    return {
        "invoice_id": invoice.InvoiceID,
        "invoice_number": invoice.InvoiceNumber,
        "customer_name": f"{customer.FirstName} {customer.LastName}" if customer else None,
        "customer_mobile": customer.Mobile if customer else None,
        "sub_total": float(invoice.SubTotal),
        "tax_amount": float(invoice.TaxAmount),
        "discount_amount": float(invoice.DiscountAmount),
        "wallet_used": float(invoice.WalletUsed),
        "total_amount": float(invoice.TotalAmount),
        "paid_amount": float(invoice.PaidAmount),
        "balance_amount": float(invoice.BalanceAmount),
        "status": invoice.Status,
        "notes": invoice.Notes,
        "created_at": invoice.CreatedAt,
        "items": [
            {
                "item_id": i.ItemID,
                "item_type": i.ItemType,
                "item_name": i.ItemName,
                "quantity": i.Quantity,
                "unit_price": float(i.UnitPrice),
                "tax_amount": float(i.TaxAmount),
                "discount_amount": float(i.DiscountAmount),
                "total_price": float(i.TotalPrice),
            }
            for i in items
        ],
        "payments": [
            {
                "payment_id": p.PaymentID,
                "payment_method": p.PaymentMethod,
                "amount": float(p.Amount),
                "status": p.Status,
                "transaction_id": p.TransactionID,
                "created_at": p.CreatedAt,
            }
            for p in payments
        ],
    }


@router.post("/payments", status_code=status.HTTP_201_CREATED)
async def record_payment(
    data: PaymentCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    invoice = (await db.execute(
        select(Invoice).where(Invoice.InvoiceID == data.invoice_id, Invoice.SalonID == salon_id)
    )).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.Status == "Paid":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice already paid")

    payment = await apply_payment(
        db, invoice, data.payment_method, data.amount,
        transaction_id=data.transaction_id,
        gateway_response=data.gateway_response,
        notes=data.notes,
        created_by_user_id=current_user.UserID,
    )

    await db.commit()
    return {
        "payment_id": payment.PaymentID,
        "invoice_status": invoice.Status,
        "paid_amount": float(invoice.PaidAmount),
        "balance_amount": float(invoice.BalanceAmount),
    }


@router.post("/coupons/validate")
async def validate_coupon(
    data: CouponValidateRequest,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    coupon = (await db.execute(
        select(Coupon).where(Coupon.CouponCode == data.coupon_code, Coupon.SalonID == salon_id, Coupon.IsActive == True)
    )).scalar_one_or_none()

    if not coupon:
        return {"is_valid": False, "message": "Coupon not found"}

    now = datetime.now()
    if coupon.ValidFrom and now < coupon.ValidFrom:
        return {"is_valid": False, "message": "Coupon not yet active"}
    if coupon.ValidUntil and now > coupon.ValidUntil:
        return {"is_valid": False, "message": "Coupon expired"}
    if coupon.MaxUses and coupon.UsedCount >= coupon.MaxUses:
        return {"is_valid": False, "message": "Coupon usage limit reached"}
    if float(data.order_amount) < float(coupon.MinOrderAmount):
        return {"is_valid": False, "message": f"Minimum order amount is {coupon.MinOrderAmount}"}

    if coupon.DiscountType == "Percent":
        discount = float(data.order_amount) * float(coupon.DiscountValue) / 100
        if coupon.MaxDiscount:
            discount = min(discount, float(coupon.MaxDiscount))
    else:
        discount = float(coupon.DiscountValue)

    return {
        "is_valid": True,
        "coupon_id": coupon.CouponID,
        "discount_type": coupon.DiscountType,
        "discount_value": float(coupon.DiscountValue),
        "discount_amount": discount,
        "message": "Coupon applied",
    }


@router.post("/coupons", status_code=status.HTTP_201_CREATED)
async def create_coupon(
    data: CouponCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    existing = (await db.execute(
        select(Coupon).where(Coupon.CouponCode == data.coupon_code, Coupon.SalonID == salon_id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Coupon code already exists")

    coupon = Coupon(
        SalonID=salon_id,
        CouponCode=data.coupon_code.upper(),
        Description=data.description,
        DiscountType=data.discount_type,
        DiscountValue=data.discount_value,
        MinOrderAmount=data.min_order_amount,
        MaxDiscount=data.max_discount,
        MaxUses=data.max_uses,
        ValidFrom=data.valid_from,
        ValidUntil=data.valid_until,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return {"coupon_id": coupon.CouponID, "coupon_code": coupon.CouponCode}


@router.post("/invoices/{invoice_id}/refund")
async def process_refund(
    invoice_id: int,
    data: RefundCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    payment = (await db.execute(
        select(Payment).where(Payment.PaymentID == data.payment_id)
    )).scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if float(data.refund_amount) > float(payment.Amount) - float(payment.RefundedAmount):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refund amount exceeds paid amount")

    payment.RefundedAmount += Decimal(str(round(float(data.refund_amount), 2)))
    payment.RefundedAt = datetime.now()
    payment.Status = "Refunded"

    invoice = (await db.execute(select(Invoice).where(Invoice.InvoiceID == invoice_id))).scalar_one_or_none()
    if invoice:
        invoice.PaidAmount -= Decimal(str(round(float(data.refund_amount), 2)))
        invoice.BalanceAmount += Decimal(str(round(float(data.refund_amount), 2)))
        invoice.Status = "Refunded"

    await db.commit()
    return {"message": "Refund processed", "refund_amount": float(data.refund_amount)}


# ── Card Terminal Integration ───────────────────────────────────────────────────
# See app/services/terminal_service.py — no processor is wired in yet.

@router.post("/terminal/initiate", response_model=TerminalInitiateResponse)
async def initiate_terminal_payment(
    data: TerminalInitiateRequest,
    salon_id: int = Depends(get_salon_id),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    """
    Ask the configured card terminal to collect payment for the given amount.
    Returns a merchant_txn_id the client uses to poll /terminal/status/{id}.
    If no gateway is configured, raises 503 so the frontend can fall back
    to manual card recording.
    """
    merchant_txn_id = generate_merchant_txn_id()
    amount_minor    = int(float(data.amount) * 100)

    try:
        result = await initiate_payment(amount_minor, merchant_txn_id, data.payment_mode)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Terminal communication error: {exc}",
        )

    if not result.get("accepted"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("message", "Terminal initiation failed"),
        )

    return TerminalInitiateResponse(
        merchant_txn_id=merchant_txn_id,
        gateway_txn_id=result.get("gateway_txn_id"),
        status="pending",
    )


@router.get("/terminal/status/{merchant_txn_id}", response_model=TerminalStatusResponse)
async def get_terminal_payment_status(
    merchant_txn_id: str,
    current_user: User = Depends(ReceptionistOrAbove()),
):
    """
    Poll the configured gateway for the current status of a terminal transaction.
    The frontend calls this every 3 s until done=true.
    """
    try:
        result = await get_payment_status(merchant_txn_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Terminal communication error: {exc}",
        )

    return TerminalStatusResponse(
        done=result["done"],
        success=result["success"],
        transaction_id=result.get("transaction_id"),
        rrn=result.get("rrn"),
        approval_code=result.get("approval_code"),
        card_last4=result.get("card_last4"),
        response_message=result.get("response_message", ""),
    )


# ── Stripe (online/manual card entry) ───────────────────────────────────────────

@router.post("/stripe/create-intent", response_model=StripeIntentResponse)
async def create_stripe_intent(
    data: StripeIntentRequest,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ReceptionistOrAbove()),
):
    """
    Creates a Stripe PaymentIntent for an already-created invoice. The frontend
    mounts Stripe's Payment Element with the returned client_secret to collect
    card details directly in the browser (card data never touches our servers).
    Raises 503 if Stripe isn't configured, so the frontend can fall back to
    manual card recording.
    """
    invoice = (await db.execute(
        select(Invoice).where(Invoice.InvoiceID == data.invoice_id, Invoice.SalonID == salon_id)
    )).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    salon = (await db.execute(select(Salon).where(Salon.SalonID == salon_id))).scalar_one_or_none()
    currency = salon.Currency if salon else "USD"

    amount_minor = int(round(float(data.amount) * 100))
    try:
        result = stripe_create_payment_intent(amount_minor, currency, invoice.InvoiceID, invoice.CustomerID)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe error: {exc}")

    return StripeIntentResponse(
        client_secret=result["client_secret"],
        payment_intent_id=result["payment_intent_id"],
        publishable_key=settings.STRIPE_PUBLISHABLE_KEY,
    )
