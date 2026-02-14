"""WhatsApp and Telegram webhook routes."""
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.integration import Integration
from app.services.rag_service import process_chat_message
from app.services.whatsapp_service import (
    verify_webhook, extract_message_from_webhook, send_whatsapp_message,
)
from app.services.telegram_service import (
    extract_message_from_update, send_telegram_message,
)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


# ─── WhatsApp ───────────────────────────────────────────

@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """WhatsApp webhook verification endpoint."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    result = verify_webhook(mode, token, challenge)
    if result:
        return Response(content=result, media_type="text/plain")

    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """WhatsApp incoming message webhook."""
    body = await request.json()
    message_data = extract_message_from_webhook(body)

    if not message_data or not message_data["text"]:
        return {"status": "ok"}

    # Find the integration for this WhatsApp number
    result = await db.execute(
        select(Integration).where(
            Integration.platform == "whatsapp",
            Integration.is_active == True,
        )
    )
    integration = result.scalar_one_or_none()

    if not integration:
        return {"status": "no_integration"}

    try:
        # Process through RAG
        response = await process_chat_message(
            db=db,
            chatbot_id=integration.chatbot_id,
            user_message=message_data["text"],
            session_id=f"wa_{message_data['from']}",
            source="whatsapp",
        )

        # Send response back via WhatsApp
        await send_whatsapp_message(
            to=message_data["from"],
            message=response["response"],
        )
    except Exception as e:
        await send_whatsapp_message(
            to=message_data["from"],
            message="Sorry, I encountered an error processing your message. Please try again.",
        )

    return {"status": "ok"}


# ─── Telegram ───────────────────────────────────────────

@router.post("/telegram/{bot_token}")
async def telegram_webhook(
    bot_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Telegram incoming message webhook."""
    update = await request.json()
    message_data = extract_message_from_update(update)

    if not message_data or not message_data["text"]:
        return {"status": "ok"}

    # Skip commands
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

    # Find matching integration
    target_integration = None
    for integ in integrations:
        config = json.loads(integ.config_json) if integ.config_json else {}
        if config.get("bot_token") == bot_token:
            target_integration = integ
            break

    if not target_integration:
        return {"status": "no_integration"}

    try:
        # Process through RAG
        response = await process_chat_message(
            db=db,
            chatbot_id=target_integration.chatbot_id,
            user_message=message_data["text"],
            session_id=f"tg_{message_data['chat_id']}",
            source="telegram",
        )

        # Send response back via Telegram
        await send_telegram_message(
            chat_id=message_data["chat_id"],
            message=response["response"],
            token=bot_token,
        )
    except Exception as e:
        await send_telegram_message(
            chat_id=message_data["chat_id"],
            message="Sorry, I encountered an error. Please try again.",
            token=bot_token,
        )

    return {"status": "ok"}
