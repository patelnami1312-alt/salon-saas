import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_payment_intent(amount_minor: int, currency: str, invoice_id: int, customer_id: int | None) -> dict:
    """amount_minor is the charge amount in the smallest currency unit (e.g. cents)."""
    if not settings.STRIPE_ENABLED:
        raise ValueError(
            "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env"
        )
    intent = stripe.PaymentIntent.create(
        amount=amount_minor,
        currency=currency.lower(),
        automatic_payment_methods={"enabled": True},
        metadata={
            "invoice_id": str(invoice_id),
            **({"customer_id": str(customer_id)} if customer_id else {}),
        },
    )
    return {"client_secret": intent["client_secret"], "payment_intent_id": intent["id"]}


def construct_webhook_event(payload: bytes, sig_header: str):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise ValueError("STRIPE_WEBHOOK_SECRET is not configured")
    return stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
