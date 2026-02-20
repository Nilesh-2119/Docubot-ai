"""
Integration CRUD routes.
Manage WhatsApp and Telegram connections per chatbot.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.chatbot import Chatbot
from app.models.integration import Integration
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.config import get_settings

settings = get_settings()

router = APIRouter(
    prefix="/api/chatbots/{chatbot_id}/integrations",
    tags=["Integrations"],
)


# ── Schemas ──────────────────────────────────────────

class CreateIntegrationRequest(BaseModel):
    platform: str  # "whatsapp" or "telegram"
    config: dict   # Platform-specific config


class UpdateIntegrationRequest(BaseModel):
    config: Optional[dict] = None
    is_active: Optional[bool] = None


# ── Helpers ──────────────────────────────────────────

async def _verify_ownership(db: AsyncSession, chatbot_id: str, user: User):
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")


def _serialize_integration(integ: Integration) -> dict:
    config = json.loads(integ.config_json) if integ.config_json else {}
    # Mask sensitive tokens for the response
    safe_config = {}
    for key, value in config.items():
        if isinstance(value, str) and len(value) > 8:
            safe_config[key] = value[:4] + "..." + value[-4:]
        else:
            safe_config[key] = value
    return {
        "id": integ.id,
        "chatbot_id": integ.chatbot_id,
        "platform": integ.platform,
        "config": safe_config,
        "is_active": integ.is_active,
        "created_at": integ.created_at.isoformat(),
    }


# ── Routes ───────────────────────────────────────────

@router.get("/")
async def list_integrations(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all integrations for a chatbot."""
    await _verify_ownership(db, chatbot_id, current_user)

    result = await db.execute(
        select(Integration).where(Integration.chatbot_id == chatbot_id)
    )
    integrations = list(result.scalars().all())
    return [_serialize_integration(i) for i in integrations]


@router.post("/")
async def create_integration(
    chatbot_id: str,
    data: CreateIntegrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new WhatsApp or Telegram integration."""
    await _verify_ownership(db, chatbot_id, current_user)

    if data.platform not in ("whatsapp", "telegram"):
        raise HTTPException(status_code=400, detail="Platform must be 'whatsapp' or 'telegram'")

    # Validate required config fields
    if data.platform == "whatsapp":
        required = ["phone_number_id", "access_token", "verify_token"]
        for field in required:
            if not data.config.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    if data.platform == "telegram":
        if not data.config.get("bot_token"):
            raise HTTPException(status_code=400, detail="Missing required field: bot_token")

    # Check for duplicate platform on this chatbot
    existing = await db.execute(
        select(Integration).where(
            Integration.chatbot_id == chatbot_id,
            Integration.platform == data.platform,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A {data.platform} integration already exists for this chatbot. Delete it first.",
        )

    integration = Integration(
        chatbot_id=chatbot_id,
        platform=data.platform,
        config_json=json.dumps(data.config),
        is_active=True,
    )
    db.add(integration)
    await db.flush()

    # Auto-register Telegram webhook
    if data.platform == "telegram":
        try:
            from app.services.telegram_service import set_webhook
            bot_token = data.config["bot_token"]
            webhook_url = f"{settings.BACKEND_URL}/api/webhooks/telegram/{bot_token}"
            result = await set_webhook(webhook_url, bot_token)
            print(f"✅ Telegram webhook set: {result}")
        except Exception as e:
            print(f"⚠️ Failed to set Telegram webhook: {e}")

    return _serialize_integration(integration)


@router.patch("/{integration_id}")
async def update_integration(
    chatbot_id: str,
    integration_id: str,
    data: UpdateIntegrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an integration's config or active status."""
    await _verify_ownership(db, chatbot_id, current_user)

    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.chatbot_id == chatbot_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    if data.config is not None:
        integration.config_json = json.dumps(data.config)

    if data.is_active is not None:
        integration.is_active = data.is_active

    await db.flush()
    return _serialize_integration(integration)


@router.delete("/{integration_id}")
async def delete_integration(
    chatbot_id: str,
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an integration."""
    await _verify_ownership(db, chatbot_id, current_user)

    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.chatbot_id == chatbot_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # If Telegram, remove webhook
    if integration.platform == "telegram":
        try:
            from app.services.telegram_service import set_webhook
            config = json.loads(integration.config_json) if integration.config_json else {}
            bot_token = config.get("bot_token")
            if bot_token:
                import httpx
                url = f"https://api.telegram.org/bot{bot_token}/deleteWebhook"
                async with httpx.AsyncClient() as client:
                    await client.post(url)
                print("✅ Telegram webhook removed")
        except Exception as e:
            print(f"⚠️ Failed to remove Telegram webhook: {e}")

    await db.delete(integration)
    await db.flush()
    return {"status": "deleted"}
