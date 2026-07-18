from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class InvoiceItemCreate(BaseModel):
    item_type: str  # Service, Product, Package, Addon
    item_ref_id: Optional[int] = None
    item_name: str
    quantity: int = 1
    unit_price: Decimal
    tax_percent: Decimal = 0
    discount_percent: Decimal = 0
    staff_id: Optional[int] = None


class InvoiceCreate(BaseModel):
    branch_id: int
    customer_id: int
    appointment_id: Optional[int] = None
    checkin_id: Optional[int] = None
    items: List[InvoiceItemCreate]
    coupon_code: Optional[str] = None
    wallet_amount: Optional[Decimal] = None
    loyalty_points: Optional[int] = None
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    invoice_id: int
    payment_method: str  # Cash, Card, Wallet, UPI, Online
    amount: Decimal
    transaction_id: Optional[str] = None
    gateway_response: Optional[str] = None
    notes: Optional[str] = None


class TerminalInitiateRequest(BaseModel):
    amount: Decimal          # total in currency (e.g. rupees), NOT paise
    payment_mode: str = "Card"  # "Card" or "UPI"


class TerminalInitiateResponse(BaseModel):
    merchant_txn_id: str
    gateway_txn_id: Optional[str] = None
    status: str              # always "pending" on success


class TerminalStatusResponse(BaseModel):
    done: bool
    success: bool
    transaction_id: Optional[str] = None
    rrn: Optional[str] = None
    approval_code: Optional[str] = None
    card_last4: Optional[str] = None
    response_message: str = ""


class StripeIntentRequest(BaseModel):
    invoice_id: int
    amount: Decimal   # total in currency (e.g. dollars), NOT cents


class StripeIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    publishable_key: str


class SplitPaymentCreate(BaseModel):
    invoice_id: int
    payments: List[PaymentCreate]


class RefundCreate(BaseModel):
    payment_id: int
    refund_amount: Decimal
    reason: Optional[str] = None


class InvoiceItemResponse(BaseModel):
    item_id: int
    item_type: str
    item_name: str
    quantity: int
    unit_price: Decimal
    tax_percent: Decimal
    tax_amount: Decimal
    discount_percent: Decimal
    discount_amount: Decimal
    total_price: Decimal
    staff_id: Optional[int]
    staff_name: Optional[str]

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    invoice_id: int
    invoice_number: str
    salon_id: int
    branch_id: int
    customer_id: int
    customer_name: Optional[str]
    appointment_id: Optional[int]
    checkin_id: Optional[int]
    sub_total: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    wallet_used: Decimal
    loyalty_used: int
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    status: str
    items: List[InvoiceItemResponse]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CouponCreate(BaseModel):
    coupon_code: str
    description: Optional[str] = None
    discount_type: str  # Percent, Fixed
    discount_value: Decimal
    min_order_amount: Decimal = 0
    max_discount: Optional[Decimal] = None
    max_uses: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class CouponValidateRequest(BaseModel):
    coupon_code: str
    order_amount: Decimal


class CouponValidateResponse(BaseModel):
    is_valid: bool
    coupon_id: Optional[int]
    discount_type: Optional[str]
    discount_value: Optional[Decimal]
    discount_amount: Optional[Decimal]
    message: str
