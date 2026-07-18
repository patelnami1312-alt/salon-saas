"""Truncate all application tables in dependency order, preserving schema."""
import asyncio
from sqlalchemy import text
from app.core.database import async_engine


TRUNCATE_SQL = """
TRUNCATE TABLE
    "Payments", "InvoiceItems", "Invoices",
    "CheckIns", "Appointments", "AppointmentAddons",
    "StockTransactions", "Inventory",
    "PurchaseOrderItems", "PurchaseOrders", "Suppliers",
    "Products", "ProductCategories",
    "Campaigns", "Notifications", "NotificationTemplates",
    "LoyaltyTransactions", "WalletTransactions",
    "CustomerAuth", "CustomerMemberships", "CustomerReviews", "Customers",
    "Commissions", "Payroll", "Leaves", "StaffAttendance", "StaffSchedules",
    "StaffServices", "Staff",
    "ServiceAddons", "ServicePackages", "PackageServices",
    "Coupons", "MembershipPlans",
    "Services", "ServiceCategories",
    "Waitlist", "RefreshTokens",
    "SalonSubscriptions", "RolePermissions", "Users",
    "Branches", "Salons", "SubscriptionPlans", "Permissions", "Roles"
RESTART IDENTITY CASCADE;
"""


async def clear():
    async with async_engine.begin() as conn:
        await conn.execute(text(TRUNCATE_SQL))
    print("[OK] All tables cleared.")


if __name__ == "__main__":
    asyncio.run(clear())
