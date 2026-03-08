"""Email service — sends OTP verification emails via SMTP."""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import get_settings

settings = get_settings()


async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send a branded OTP verification email.

    Returns True on success, False on failure.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"⚠️ SMTP not configured — OTP for {to_email}: {otp_code}")
        return True  # Allow dev mode without SMTP

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg["Subject"] = f"Your DocuBot AI Verification Code: {otp_code}"

    # Plain text fallback
    text = f"Your DocuBot AI verification code is: {otp_code}\n\nThis code expires in 5 minutes."

    # HTML email
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
            <tr>
                <td align="center">
                    <table width="460" cellpadding="0" cellspacing="0" style="background-color:#12121a;border-radius:16px;border:1px solid #1e1e2e;overflow:hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
                                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                                    🤖 DocuBot AI
                                </h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding:36px 32px;">
                                <h2 style="margin:0 0 8px;color:#ffffff;font-size:20px;font-weight:600;">
                                    Verify your email
                                </h2>
                                <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;line-height:1.6;">
                                    Enter this code to complete your registration. It expires in <strong style="color:#c4b5fd;">5 minutes</strong>.
                                </p>
                                <!-- OTP Code -->
                                <div style="background-color:#1a1a2e;border:2px dashed #6366f1;border-radius:12px;padding:20px;text-align:center;margin-bottom:28px;">
                                    <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#ffffff;font-family:'Courier New',monospace;">
                                        {otp_code}
                                    </span>
                                </div>
                                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
                                    If you didn't request this code, you can safely ignore this email.
                                </p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding:20px 32px;border-top:1px solid #1e1e2e;">
                                <p style="margin:0;color:#4b5563;font-size:11px;text-align:center;">
                                    © 2026 DocuBot AI · Powered by RAG Technology
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"✅ OTP email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send OTP email to {to_email}: {e}")
        return False
