"""
Card-present terminal gateway abstraction.

No real processor is wired in yet. The physical terminal's actual payment
processor (the company whose software runs the transaction, separate from
whichever bank the funds settle into) hasn't been confirmed, so
initiate_payment/get_payment_status always raise ValueError, which the
/billing/terminal/* routes turn into a 503 the frontend treats as "terminal
not connected — fall back to manual entry."

To wire in a real provider once confirmed:
1. Add a class below implementing TerminalGateway using that provider's
   OWN documented API (base URL, auth fields, request/response shape) —
   verify against their real docs, don't guess at field names.
2. Register it in _GATEWAYS under a short key (e.g. "square").
3. Set PAYMENT_GATEWAY_PROVIDER to that key and fill in
   PAYMENT_GATEWAY_MERCHANT_ID / PAYMENT_GATEWAY_API_KEY in .env.

initiate_payment() must return: {"accepted": bool, "gateway_txn_id": str|None, "message": str}
get_payment_status() must return: {"done": bool, "success": bool, "transaction_id": str|None,
    "rrn": str|None, "approval_code": str|None, "card_last4": str|None, "response_message": str}
This normalized shape is our own contract — map each provider's raw response into it.
"""
import uuid
from abc import ABC, abstractmethod
from datetime import datetime

from app.core.config import settings


def generate_merchant_txn_id() -> str:
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"TERM-{stamp}-{suffix}"


class TerminalGateway(ABC):
    @abstractmethod
    async def initiate_payment(self, amount_minor: int, merchant_txn_id: str, payment_mode: str) -> dict:
        """amount_minor is the charge amount in the smallest currency unit (cents/paise)."""

    @abstractmethod
    async def get_payment_status(self, merchant_txn_id: str) -> dict:
        ...


_GATEWAYS: dict[str, type[TerminalGateway]] = {
    # "square": SquareTerminalGateway,
    # "stripe_terminal": StripeTerminalGateway,
}


def _get_gateway() -> TerminalGateway:
    if not settings.PAYMENT_GATEWAY_ENABLED:
        raise ValueError(
            "No card terminal configured. Set PAYMENT_GATEWAY_PROVIDER and "
            "PAYMENT_GATEWAY_API_KEY in .env once the processor is confirmed."
        )
    gateway_cls = _GATEWAYS.get(settings.PAYMENT_GATEWAY_PROVIDER)
    if gateway_cls is None:
        raise ValueError(
            f"No adapter implemented for PAYMENT_GATEWAY_PROVIDER="
            f"'{settings.PAYMENT_GATEWAY_PROVIDER}'. Add one in terminal_service.py."
        )
    return gateway_cls()


async def initiate_payment(amount_minor: int, merchant_txn_id: str, payment_mode: str = "Card") -> dict:
    return await _get_gateway().initiate_payment(amount_minor, merchant_txn_id, payment_mode)


async def get_payment_status(merchant_txn_id: str) -> dict:
    return await _get_gateway().get_payment_status(merchant_txn_id)
