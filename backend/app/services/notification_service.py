from typing import Optional
from loguru import logger

from app.core.config import settings


class NotificationService:

    @staticmethod
    async def send_email(to: str, subject: str, body: str, html: Optional[str] = None) -> bool:
        try:
            from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

            conf = ConnectionConfig(
                MAIL_USERNAME=settings.MAIL_USERNAME,
                MAIL_PASSWORD=settings.MAIL_PASSWORD,
                MAIL_FROM=settings.MAIL_FROM,
                MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
                MAIL_PORT=settings.MAIL_PORT,
                MAIL_SERVER=settings.MAIL_SERVER,
                MAIL_STARTTLS=settings.MAIL_STARTTLS,
                MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
                USE_CREDENTIALS=True,
            )

            message = MessageSchema(
                subject=subject,
                recipients=[to],
                body=html or body,
                subtype="html" if html else "plain",
            )

            fm = FastMail(conf)
            await fm.send_message(message)
            logger.info(f"Email sent to {to}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Email send failed to {to}: {e}")
            return False

    @staticmethod
    async def send_sms(to: str, message: str) -> bool:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(body=message, from_=settings.TWILIO_PHONE_NUMBER, to=to)
            logger.info(f"SMS sent to {to}")
            return True
        except Exception as e:
            logger.error(f"SMS send failed to {to}: {e}")
            return False

    @staticmethod
    async def send_appointment_confirmation(customer_name: str, customer_email: str, customer_mobile: str,
                                             service_name: str, staff_name: str, appointment_date: str,
                                             start_time: str, branch_name: str) -> None:
        email_body = f"""
        <html><body>
        <h2>Appointment Confirmed!</h2>
        <p>Dear {customer_name},</p>
        <p>Your appointment has been confirmed:</p>
        <ul>
            <li><b>Service:</b> {service_name}</li>
            <li><b>Staff:</b> {staff_name}</li>
            <li><b>Date:</b> {appointment_date}</li>
            <li><b>Time:</b> {start_time}</li>
            <li><b>Branch:</b> {branch_name}</li>
        </ul>
        <p>Thank you for choosing us!</p>
        </body></html>
        """

        sms_body = (
            f"Appointment confirmed! {service_name} with {staff_name} "
            f"on {appointment_date} at {start_time} at {branch_name}. "
            f"See you then!"
        )

        if customer_email:
            await NotificationService.send_email(
                to=customer_email,
                subject="Appointment Confirmation - SalonSaaS",
                body=email_body,
                html=email_body,
            )

        if customer_mobile:
            await NotificationService.send_sms(to=customer_mobile, message=sms_body)

    @staticmethod
    async def send_appointment_reminder(customer_name: str, customer_email: str, customer_mobile: str,
                                         service_name: str, appointment_date: str, start_time: str,
                                         hours_before: int = 24) -> None:
        message = (
            f"Reminder: {customer_name}, your {service_name} appointment is "
            f"{'tomorrow' if hours_before == 24 else 'in 1 hour'} at {start_time} on {appointment_date}."
        )

        if customer_mobile:
            await NotificationService.send_sms(to=customer_mobile, message=message)
        if customer_email:
            await NotificationService.send_email(
                to=customer_email,
                subject="Appointment Reminder",
                body=message,
            )

    @staticmethod
    async def send_birthday_wish(customer_name: str, customer_email: str, customer_mobile: str) -> None:
        message = f"Happy Birthday {customer_name}! 🎂 Wishing you a wonderful day. Visit us today and enjoy a special birthday discount!"
        if customer_mobile:
            await NotificationService.send_sms(to=customer_mobile, message=message)
        if customer_email:
            await NotificationService.send_email(
                to=customer_email,
                subject="Happy Birthday from SalonSaaS!",
                body=message,
            )

    @staticmethod
    async def send_invoice(customer_name: str, customer_email: str, invoice_number: str,
                            total_amount: float) -> None:
        body = f"""
        <html><body>
        <h2>Invoice #{invoice_number}</h2>
        <p>Dear {customer_name},</p>
        <p>Thank you for your visit! Your invoice total is <b>${total_amount:.2f}</b>.</p>
        <p>Invoice Number: {invoice_number}</p>
        </body></html>
        """
        if customer_email:
            await NotificationService.send_email(
                to=customer_email,
                subject=f"Invoice {invoice_number}",
                body=body,
                html=body,
            )
