import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_, text
from datetime import date, datetime, timedelta
from loguru import logger

from app.core.database import AsyncSessionLocal
from app.services.notification_service import NotificationService


scheduler = AsyncIOScheduler()


async def send_appointment_reminders():
    """Send reminders for appointments 24 hours and 1 hour in advance."""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.appointment import Appointment
            from app.models.customer import Customer
            from app.models.service import Service

            tomorrow = date.today() + timedelta(days=1)
            now = datetime.now()
            one_hour_later = now + timedelta(hours=1)

            # 24-hour reminders
            result = await db.execute(
                select(Appointment).where(
                    Appointment.AppointmentDate == tomorrow,
                    Appointment.Status.in_(["Scheduled", "Confirmed"]),
                    Appointment.Reminder24hSent == False,
                )
            )
            appointments_24h = result.scalars().all()

            for appt in appointments_24h:
                customer = (await db.execute(select(Customer).where(Customer.CustomerID == appt.CustomerID))).scalar_one_or_none()
                service = (await db.execute(select(Service).where(Service.ServiceID == appt.ServiceID))).scalar_one_or_none()
                if customer and service:
                    await NotificationService.send_appointment_reminder(
                        customer_name=f"{customer.FirstName} {customer.LastName}",
                        customer_email=customer.Email,
                        customer_mobile=customer.Mobile,
                        service_name=service.ServiceName,
                        appointment_date=str(appt.AppointmentDate),
                        start_time=str(appt.StartTime),
                        hours_before=24,
                    )
                    appt.Reminder24hSent = True
                    appt.ReminderSent = True

            await db.commit()
            logger.info(f"Sent 24h reminders for {len(appointments_24h)} appointments")

        except Exception as e:
            logger.error(f"Reminder task error: {e}")


async def send_birthday_wishes():
    """Send birthday wishes to customers."""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.customer import Customer
            today = date.today()

            result = await db.execute(
                select(Customer).where(
                    Customer.IsActive == True,
                    Customer.DateOfBirth != None,
                )
            )
            customers = result.scalars().all()

            for customer in customers:
                if (customer.DateOfBirth and
                        customer.DateOfBirth.month == today.month and
                        customer.DateOfBirth.day == today.day):
                    await NotificationService.send_birthday_wish(
                        customer_name=f"{customer.FirstName} {customer.LastName}",
                        customer_email=customer.Email,
                        customer_mobile=customer.Mobile,
                    )

            logger.info("Birthday wishes task completed")
        except Exception as e:
            logger.error(f"Birthday task error: {e}")


async def expire_memberships():
    """Mark expired memberships."""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.customer import CustomerMembership
            today = date.today()
            result = await db.execute(
                select(CustomerMembership).where(
                    CustomerMembership.EndDate < today,
                    CustomerMembership.Status == "Active",
                )
            )
            for membership in result.scalars().all():
                membership.Status = "Expired"

            await db.commit()
        except Exception as e:
            logger.error(f"Membership expiry task error: {e}")


async def pending_notifications_retry():
    """Retry failed notifications."""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.notification import Notification
            result = await db.execute(
                select(Notification).where(
                    Notification.Status == "Failed",
                    Notification.RetryCount < 3,
                )
            )
            for notif in result.scalars().all():
                success = False
                if notif.Type == "Email":
                    success = await NotificationService.send_email(
                        to=str(notif.RecipientID),
                        subject=notif.Subject or "Notification",
                        body=notif.Message,
                    )
                if success:
                    notif.Status = "Sent"
                    notif.SentAt = datetime.now()
                else:
                    notif.RetryCount += 1

            await db.commit()
        except Exception as e:
            logger.error(f"Notification retry error: {e}")


async def run_outbox_relay():
    """
    Poll the outbox_events table every 200ms and publish pending events to Redis.
    Uses FOR UPDATE SKIP LOCKED so multiple workers never double-publish the same row.
    """
    from app.core.redis_client import get_redis
    try:
        redis = await get_redis()
        if not redis:
            return

        async with AsyncSessionLocal() as session:
            rows = (await session.execute(text("""
                SELECT id, salon_id, event_type, payload
                FROM outbox_events
                WHERE published_at IS NULL
                ORDER BY created_at
                LIMIT 50
                FOR UPDATE SKIP LOCKED
            """))).all()

            if not rows:
                return

            for row in rows:
                try:
                    await redis.publish("salon_appointments", json.dumps({
                        "salon_id": row.salon_id,
                        "payload": row.payload,
                    }, default=str))
                except Exception as exc:
                    logger.warning(f"Outbox relay: Redis publish failed — {exc}")
                    return  # try again next tick

                await session.execute(
                    text("UPDATE outbox_events SET published_at = now() WHERE id = :id"),
                    {"id": row.id},
                )

            await session.commit()
            logger.debug(f"Outbox relay: published {len(rows)} event(s)")
    except Exception as exc:
        logger.error(f"Outbox relay error: {exc}")


def setup_scheduler():
    scheduler.add_job(send_appointment_reminders, CronTrigger(hour=8, minute=0), id="appointment_reminders")
    scheduler.add_job(send_birthday_wishes, CronTrigger(hour=9, minute=0), id="birthday_wishes")
    scheduler.add_job(expire_memberships, CronTrigger(hour=0, minute=5), id="expire_memberships")
    scheduler.add_job(pending_notifications_retry, CronTrigger(minute="*/30"), id="retry_notifications")
    scheduler.add_job(run_outbox_relay, IntervalTrigger(seconds=0.2), id="outbox_relay", max_instances=1)
    scheduler.start()
    logger.info("Background scheduler started")


def shutdown_scheduler():
    scheduler.shutdown()
    logger.info("Background scheduler stopped")
