"""WhatsApp and Telegram webhook routes."""
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.integration import Integration
from app.models.whatsapp_connection import WhatsAppConnection
from app.services.rag_service import process_chat_message
from app.services.whatsapp_service import (
    extract_message_from_webhook,
    send_whatsapp_message,
    verify_webhook,
)
from app.services.telegram_service import (
    extract_message_from_update, send_telegram_message,
)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


# ─── WhatsApp (shared number) ──────────────────────────

@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """WhatsApp webhook verification — uses env-based verify token."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    result = verify_webhook(mode or "", token or "", challenge or "")
    if result:
        return Response(content=result, media_type="text/plain")

    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """WhatsApp incoming message — shared number flow.

    1. If message starts with 'START DOCU-XXXX' → validate & link phone
    2. If phone already linked → route to chatbot via RAG
    3. If unknown phone → reply with instructions
    """
    body = await request.json()
    message_data = extract_message_from_webhook(body)

    if not message_data or not message_data.get("text"):
        return {"status": "ok"}

    sender_phone = message_data["from"]
    text = message_data["text"].strip()

    # ── Check if phone is already linked ──
    result = await db.execute(
        select(WhatsAppConnection).where(
            WhatsAppConnection.whatsapp_phone == sender_phone,
            WhatsAppConnection.verified == True,
        )
    )
    existing_conn = result.scalar_one_or_none()

    if existing_conn:
        # Phone is linked — route to chatbot
        try:
            response = await process_chat_message(
                db=db,
                chatbot_id=existing_conn.chatbot_id,
                user_message=text,
                session_id=f"wa_{sender_phone}",
                source="whatsapp",
            )
            await send_whatsapp_message(
                to=sender_phone,
                message=response["response"],
            )
        except Exception as e:
            print(f"❌ WhatsApp RAG error: {e}")
            await send_whatsapp_message(
                to=sender_phone,
                message="Sorry, I encountered an error processing your message. Please try again.",
            )
        return {"status": "ok"}

    # ── Check if message is a START command ──
    if text.upper().startswith("START "):
        code = text.split(" ", 1)[1].strip().upper()

        # Look up the access code
        result = await db.execute(
            select(WhatsAppConnection).where(
                WhatsAppConnection.access_code == code
            )
        )
        conn = result.scalar_one_or_none()

        if not conn:
            await send_whatsapp_message(
                to=sender_phone,
                message=(
                    "❌ Invalid access code.\n\n"
                    "Please check your code and try again.\n"
                    "Format: START DOCU-XXXX"
                ),
            )
            return {"status": "invalid_code"}

        if conn.verified and conn.whatsapp_phone and conn.whatsapp_phone != sender_phone:
            await send_whatsapp_message(
                to=sender_phone,
                message=(
                    "⚠️ This code is already linked to another phone number.\n"
                    "Please contact the chatbot owner for a new code."
                ),
            )
            return {"status": "already_linked"}

        # Link phone to chatbot
        conn.whatsapp_phone = sender_phone
        conn.verified = True
        await db.flush()

        await send_whatsapp_message(
            to=sender_phone,
            message=(
                "✅ Connected successfully!\n\n"
                "You can now ask me anything. I'll respond using AI.\n"
                "Just type your question and send it!"
            ),
        )
        return {"status": "verified"}

    # ── Unknown phone, no START command ──
    await send_whatsapp_message(
        to=sender_phone,
        message=(
            "👋 Welcome to DocuBot AI!\n\n"
            "To get started, you need an access code from a chatbot owner.\n\n"
            "Send: START DOCU-XXXX\n"
            "(Replace DOCU-XXXX with your actual code)"
        ),
    )
    return {"status": "instructions_sent"}


# ─── Telegram (per-integration credentials) ────────────

@router.post("/telegram/{bot_token}")
async def telegram_webhook(
    bot_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Telegram incoming message webhook."""
    update = await request.json()
    message_data = extract_message_from_update(update)

    if not message_data or not message_data.get("text"):
        return {"status": "ok"}

    # Handle /start command
    if message_data["text"].startswith("/start"):
        await send_telegram_message(
            chat_id=message_data["chat_id"],
            message="👋 Hello! I'm an AI assistant. Ask me anything about the documents I've been trained on!",
            token=bot_token,
        )
        return {"status": "ok"}

    # Find integration by bot token
    result = await db.execute(
        select(Integration).where(
            Integration.platform == "telegram",
            Integration.is_active == True,
        )
    )
    integrations = list(result.scalars().all())

    target_integration = None
    for integ in integrations:
        config = json.loads(integ.config_json) if integ.config_json else {}
        if config.get("bot_token") == bot_token:
            target_integration = integ
            break

    if not target_integration:
        return {"status": "no_integration"}

    try:
        response = await process_chat_message(
            db=db,
            chatbot_id=target_integration.chatbot_id,
            user_message=message_data["text"],
            session_id=f"tg_{message_data['chat_id']}",
            source="telegram",
        )
        await send_telegram_message(
            chat_id=message_data["chat_id"],
            message=response["response"],
            token=bot_token,
        )
    except Exception as e:
        print(f"❌ Telegram webhook error: {e}")
        await send_telegram_message(
            chat_id=message_data["chat_id"],
            message="Sorry, I encountered an error. Please try again.",
            token=bot_token,
        )

    return {"status": "ok"}
