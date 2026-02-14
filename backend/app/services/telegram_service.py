"""
Telegram Bot API integration service.
"""
import httpx
from app.config import get_settings

settings = get_settings()


def get_telegram_api_url(token: str = None) -> str:
    """Get the Telegram Bot API base URL."""
    bot_token = token or settings.TELEGRAM_BOT_TOKEN
    return f"https://api.telegram.org/bot{bot_token}"


async def send_telegram_message(chat_id: int | str, message: str, token: str = None) -> dict:
    """Send a text message via Telegram Bot API."""
    url = f"{get_telegram_api_url(token)}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.json()


async def set_webhook(webhook_url: str, token: str = None) -> dict:
    """Set the webhook URL for Telegram bot."""
    url = f"{get_telegram_api_url(token)}/setWebhook"
    payload = {"url": webhook_url}

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.json()


def extract_message_from_update(update: dict) -> dict | None:
    """Extract chat_id and text from a Telegram update."""
    try:
        message = update.get("message", {})
        text = message.get("text", "")
        chat_id = message["chat"]["id"]
        user_id = message["from"]["id"]

        return {
            "chat_id": chat_id,
            "user_id": user_id,
            "text": text,
            "message_id": message["message_id"],
        }
    except (KeyError, TypeError):
        return None
