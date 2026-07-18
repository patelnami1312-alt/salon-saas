from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice, InvoiceItem, Payment
from app.models.staff import Staff, Commission


async def apply_payment(
    db: AsyncSession,
    invoice: Invoice,
    payment_method: str,
    amount,
    transaction_id: Optional[str] = None,
    gateway_response: Optional[str] = None,
    notes: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
) -> Payment:
    """Records a Payment against an invoice and updates invoice status/commissions.
    Shared by the manual payment route and the Stripe webhook so both paths
    apply the exact same ledger + commission-accrual logic.
    """
    payment = Payment(
        InvoiceID=invoice.InvoiceID,
        CustomerID=invoice.CustomerID,
        PaymentMethod=payment_method,
        Amount=amount,
        TransactionID=transaction_id,
        GatewayResponse=gateway_response,
        Notes=notes,
        CreatedByUserID=created_by_user_id,
    )
    db.add(payment)

    invoice.PaidAmount += Decimal(str(round(float(amount), 2)))
    invoice.BalanceAmount = invoice.TotalAmount - invoice.PaidAmount

    if float(invoice.BalanceAmount) <= 0:
        invoice.Status = "Paid"
        invoice.BalanceAmount = Decimal("0")

        items_result = await db.execute(
            select(InvoiceItem).where(InvoiceItem.InvoiceID == invoice.InvoiceID, InvoiceItem.StaffID != None)
        )
        for inv_item in items_result.scalars().all():
            staff_result = await db.execute(select(Staff).where(Staff.StaffID == inv_item.StaffID))
            staff = staff_result.scalar_one_or_none()
            if staff and float(staff.CommissionPercent) > 0:
                db.add(Commission(
                    StaffID=inv_item.StaffID,
                    InvoiceID=invoice.InvoiceID,
                    InvoiceItemID=inv_item.ItemID,
                    BaseAmount=float(inv_item.TotalPrice),
                    CommissionPercent=float(staff.CommissionPercent),
                    Amount=float(inv_item.TotalPrice) * float(staff.CommissionPercent) / 100,
                    Status="Pending",
                ))
    elif float(invoice.PaidAmount) > 0:
        invoice.Status = "PartiallyPaid"

    return payment
