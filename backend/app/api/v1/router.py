from fastapi import APIRouter
from app.api.v1 import (
    auth, customers, staff, appointments, checkins, billing, inventory,
    reports, notifications, services, salon,
    commissions, memberships, gift_cards, booking, ai, customer_portal,
    super_admin, payroll, packages, waitlist, webhooks, cron,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(customers.router)
api_router.include_router(staff.router)
api_router.include_router(appointments.router)
api_router.include_router(checkins.router)
api_router.include_router(billing.router)
api_router.include_router(inventory.router)
api_router.include_router(reports.router)
api_router.include_router(notifications.router)
api_router.include_router(services.router)
api_router.include_router(salon.router)
api_router.include_router(commissions.router)
api_router.include_router(memberships.router)
api_router.include_router(gift_cards.router)
api_router.include_router(booking.router)
api_router.include_router(ai.router)
api_router.include_router(customer_portal.router)
api_router.include_router(super_admin.router)
api_router.include_router(payroll.router)
api_router.include_router(packages.router)
api_router.include_router(waitlist.router)
api_router.include_router(webhooks.router)
api_router.include_router(cron.router)
