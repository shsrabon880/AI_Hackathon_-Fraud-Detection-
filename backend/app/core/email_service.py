"""Real email delivery service for Sign-Up OTP and Password Reset OTP verification."""

from email.message import EmailMessage
import logging
import smtplib
import httpx

from app.core.config import get_settings

logger = logging.getLogger("fraudshield.email")


class EmailDeliveryError(Exception):
    """Raised when outbound email delivery fails or is unconfigured."""


def _dispatch_email(recipient_email: str, subject: str, text_body: str, html_body: str) -> None:
    """Deliver email via Resend API or configured SMTP server. Never logs OTPs."""
    settings = get_settings()
    from_addr = settings.SMTP_FROM_EMAIL.strip() or settings.SMTP_USERNAME.strip() or "onboarding@resend.dev"

    # 1. Prefer Brevo Transactional Email HTTPS API (works on Render free tier for any recipient email)
    if settings.BREVO_API_KEY.strip():
        try:
            resp = httpx.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": settings.BREVO_API_KEY.strip(),
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "sender": {"name": "FinSphere AI - FraudShield", "email": from_addr},
                    "to": [{"email": recipient_email}],
                    "subject": subject,
                    "textContent": text_body,
                    "htmlContent": html_body,
                },
                timeout=10.0,
            )
            if resp.status_code >= 400:
                logger.error("Email delivery via Brevo returned status %s", resp.status_code)
                raise EmailDeliveryError("Unable to send verification email via Brevo.")
            return
        except httpx.HTTPError as exc:
            logger.error("HTTP transport error while sending verification email via Brevo: %s", type(exc).__name__)
            raise EmailDeliveryError("Email service temporarily unreachable.") from exc

    if settings.RESEND_API_KEY.strip():
        try:
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY.strip()}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_addr,
                    "to": [recipient_email],
                    "subject": subject,
                    "text": text_body,
                    "html": html_body,
                },
                timeout=10.0,
            )
            if resp.status_code >= 400:
                logger.error("Email delivery via Resend returned status %s", resp.status_code)
                raise EmailDeliveryError("Unable to send verification email via email provider.")
            return
        except httpx.HTTPError as exc:
            logger.error("HTTP transport error while sending verification email: %s", type(exc).__name__)
            raise EmailDeliveryError("Email service temporarily unreachable.") from exc

    if settings.SMTP_HOST.strip() and settings.SMTP_USERNAME.strip() and settings.SMTP_PASSWORD.strip():
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = recipient_email
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")
        try:
            with smtplib.SMTP(settings.SMTP_HOST.strip(), settings.SMTP_PORT, timeout=12) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                server.login(settings.SMTP_USERNAME.strip(), settings.SMTP_PASSWORD.strip())
                server.send_message(msg)
            return
        except Exception as exc:
            logger.error("SMTP error delivering email: %s", type(exc).__name__)
            raise EmailDeliveryError("SMTP server failed to deliver email.") from exc

    raise EmailDeliveryError(
        "Email delivery provider is not configured. Please set RESEND_API_KEY or SMTP credentials on the server."
    )


def _otp_html(title: str, subtitle: str, full_name: str, intro: str, otp_code: str, expiry_mins: int) -> str:
    return (
        "<div style=\"font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;"
        "background:#0d1322;color:#e2e8f0;padding:28px;border-radius:12px;border:1px solid #1d2842;\">"
        f"<h2 style=\"margin:0 0 8px;color:#ffffff;\">{title}</h2>"
        f"<p style=\"margin:0 0 18px;color:#a78bfa;font-size:12px;letter-spacing:1px;\">{subtitle}</p>"
        f"<p>Hello <strong>{full_name}</strong>,</p>"
        f"<p>{intro}</p>"
        f"<div style=\"margin:20px 0;padding:16px;background:#080d1a;border:1px solid #4c3599;"
        f"border-radius:8px;text-align:center;font-size:30px;font-weight:bold;letter-spacing:8px;color:#ffffff;\">{otp_code}</div>"
        f"<p style=\"font-size:13px;color:#94a3b8;\">This one-time code expires in {expiry_mins} minutes. Never share this code with anyone.</p>"
        "</div>"
    )


def send_signup_otp_email(recipient_email: str, full_name: str, otp_code: str) -> None:
    """Send 6-digit Sign-Up verification OTP."""
    settings = get_settings()
    expiry_mins = settings.EMAIL_OTP_EXPIRE_SECONDS // 60
    subject = "FinSphere AI - FraudShield: Verify Your Email Address"
    text_body = (
        f"Hello {full_name},\n\n"
        f"Thank you for signing up for FinSphere AI - FraudShield.\n"
        f"Your 6-digit email verification OTP is: {otp_code}\n\n"
        f"This code expires in {expiry_mins} minutes and can only be used once.\n"
    )
    html_body = _otp_html(
        "FinSphere AI - FraudShield",
        "SIGN-UP EMAIL VERIFICATION",
        full_name,
        "Use the 6-digit verification code below to verify your email address and activate your FraudShield account:",
        otp_code,
        expiry_mins,
    )
    _dispatch_email(recipient_email, subject, text_body, html_body)


def send_password_reset_otp_email(recipient_email: str, full_name: str, otp_code: str) -> None:
    """Send 6-digit Forgot Password reset OTP."""
    settings = get_settings()
    expiry_mins = settings.EMAIL_OTP_EXPIRE_SECONDS // 60
    subject = "FinSphere AI - FraudShield: Password Reset Code"
    text_body = (
        f"Hello {full_name},\n\n"
        f"We received a request to reset your FinSphere AI - FraudShield password.\n"
        f"Your 6-digit reset OTP is: {otp_code}\n\n"
        f"This code expires in {expiry_mins} minutes. If you did not request this, ignore this email.\n"
    )
    html_body = _otp_html(
        "FinSphere AI - FraudShield",
        "PASSWORD RESET VERIFICATION",
        full_name,
        "Use the 6-digit security code below to reset your FraudShield account password:",
        otp_code,
        expiry_mins,
    )
    _dispatch_email(recipient_email, subject, text_body, html_body)
