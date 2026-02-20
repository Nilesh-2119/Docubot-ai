"""
WhatsApp shared-number routes.
Enable/disable WhatsApp for a chatbot, generate access codes.
"""
import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.chatbot import Chatbot
from app.models.user import User
from app.models.whatsapp_connection import WhatsAppConnection
from app.middleware.auth_middleware import get_current_user
from app.config import get_settings

settings = get_settings()

router = APIRouter(
    prefix="/api/chatbots/{chatbot_id}/whatsapp",
    tags=["WhatsApp"],
)


def _generate_access_code() -> str:
    """Generate a unique code like DOCU-A7X2."""
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=4))
    return f"DOCU-{suffix}"


def _serialize(conn: WhatsAppConnection) -> dict:
    return {
        "id": conn.id,
        "chatbot_id": conn.chatbot_id,
        "access_code": conn.access_code,
        "whatsapp_phone": conn.whatsapp_phone,
        "verified": conn.verified,
        "created_at": conn.created_at.isoformat(),
    }


async def _verify_ownership(db: AsyncSession, chatbot_id: str, user: User):
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == user.id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    return chatbot


@router.get("/status")
async def whatsapp_status(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if WhatsApp is enabled for this chatbot."""
    await _verify_ownership(db, chatbot_id, current_user)

    result = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.chatbot_id == chatbot_id)
    )
    conn = result.scalar_one_or_none()

    if not conn:
        return {"enabled": False}

    return {
        "enabled": True,
        **_serialize(conn),
    }


@router.post("/enable")
async def enable_whatsapp(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable WhatsApp for this chatbot. Generates a unique access code."""
    await _verify_ownership(db, chatbot_id, current_user)

    # Enforce plan limit
    from app.services.subscription_service import check_whatsapp_allowed
    await check_whatsapp_allowed(db, current_user.id)

    # Check if already enabled
    existing = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.chatbot_id == chatbot_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="WhatsApp is already enabled for this chatbot.",
        )

    # Generate unique access code (retry if collision)
    for _ in range(10):
        code = _generate_access_code()
        collision = await db.execute(
            select(WhatsAppConnection).where(WhatsAppConnection.access_code == code)
        )
        if not collision.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique code")

    conn = WhatsAppConnection(
        chatbot_id=chatbot_id,
        user_id=current_user.id,
        access_code=code,
        verified=False,
    )
    db.add(conn)
    await db.flush()

    return {
        "enabled": True,
        **_serialize(conn),
        "instructions": f"Send 'START {code}' to our WhatsApp number to connect.",
    }


@router.delete("/disable")
async def disable_whatsapp(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable WhatsApp for this chatbot."""
    await _verify_ownership(db, chatbot_id, current_user)

    result = await db.execute(
        select(WhatsAppConnection).where(WhatsAppConnection.chatbot_id == chatbot_id)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="WhatsApp is not enabled for this chatbot.")

    await db.delete(conn)
    await db.flush()

    return {"enabled": False, "status": "disabled"}
