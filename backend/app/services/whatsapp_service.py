"""
WhatsApp Business Cloud API integration service.
"""
import httpx
from app.config import get_settings

settings = get_settings()

WHATSAPP_API_URL = f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"


async def send_whatsapp_message(to: str, message: str) -> dict:
    """Send a text message via WhatsApp Business Cloud API."""
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(WHATSAPP_API_URL, json=payload, headers=headers)
            res_data = response.json()
            
            if response.status_code != 200:
                print(f"❌ Meta API Error ({response.status_code}): {res_data}")
            elif settings.RAG_DEBUG:
                print(f"✅ Meta API Success: {res_data}")
                
            return res_data
        except Exception as e:
            print(f"❌ httpx Error sending WhatsApp: {e}")
            return {"error": str(e)}


def verify_webhook(mode: str, token: str, challenge: str) -> str | None:
    """Verify WhatsApp webhook subscription."""
    if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
        return challenge
    return None


def extract_message_from_webhook(body: dict) -> dict | None:
    """Extract sender phone and message text from WhatsApp webhook payload."""
    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return None

        msg = messages[0]
        return {
            "from": msg["from"],
            "text": msg.get("text", {}).get("body", ""),
            "message_id": msg["id"],
            "timestamp": msg["timestamp"],
        }
    except (IndexError, KeyError):
        return None
