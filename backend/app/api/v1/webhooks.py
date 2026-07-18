from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from app.core.database import get_async_db
from app.models.billing import Invoice, Payment
from app.services.payment_ledger import apply_payment
from app.services.stripe_gateway import construct_webhook_event

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_async_db)):
    """
    Authenticates via Stripe's signature header, not a user token — Stripe's
    servers call this directly. Finalizes the invoice/payment if the frontend
    never got to (e.g. the tab closed right after a successful charge); a no-op
    if the payment was already recorded.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = construct_webhook_event(payload, sig_header)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        invoice_id = intent.get("metadata", {}).get("invoice_id")

        if invoice_id:
            invoice = (await db.execute(
                select(Invoice).where(Invoice.InvoiceID == int(invoice_id))
            )).scalar_one_or_none()

            if invoice and invoice.Status != "Paid":
                already_recorded = (await db.execute(
                    select(Payment).where(Payment.TransactionID == intent["id"])
                )).scalar_one_or_none()

                if not already_recorded:
                    await apply_payment(
                        db, invoice, "Card", intent["amount"] / 100,
                        transaction_id=intent["id"],
                        gateway_response="Stripe webhook: payment_intent.succeeded",
                        notes="Recorded via Stripe webhook",
                        created_by_user_id=None,
                    )
                    await db.commit()

    return {"received": True}
