"""Dashboard and usage stats routes."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.schemas.schemas import UsageStats
from app.models.user import User
from app.models.chatbot import Chatbot
from app.models.document import Document
from app.models.embedding import Embedding
from app.models.conversation import Conversation
from app.models.message import Message
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=UsageStats)
async def get_usage_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get usage statistics for the current user."""
    # Get user's chatbot IDs
    chatbot_result = await db.execute(
        select(Chatbot.id).where(Chatbot.user_id == current_user.id)
    )
    chatbot_ids = [row[0] for row in chatbot_result.fetchall()]

    total_chatbots = len(chatbot_ids)

    if not chatbot_ids:
        return UsageStats(
            total_chatbots=0,
            total_documents=0,
            total_embeddings=0,
            total_conversations=0,
            total_messages=0,
            messages_today=0,
        )

    # Total documents
    doc_result = await db.execute(
        select(func.count(Document.id)).where(Document.chatbot_id.in_(chatbot_ids))
    )
    total_documents = doc_result.scalar() or 0

    # Total embeddings
    emb_result = await db.execute(
        select(func.count(Embedding.id)).where(Embedding.chatbot_id.in_(chatbot_ids))
    )
    total_embeddings = emb_result.scalar() or 0

    # Total conversations
    conv_result = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.chatbot_id.in_(chatbot_ids))
    )
    total_conversations = conv_result.scalar() or 0

    # Total messages
    conv_ids_result = await db.execute(
        select(Conversation.id).where(Conversation.chatbot_id.in_(chatbot_ids))
    )
    conv_ids = [row[0] for row in conv_ids_result.fetchall()]

    total_messages = 0
    messages_today = 0

    if conv_ids:
        msg_result = await db.execute(
            select(func.count(Message.id)).where(Message.conversation_id.in_(conv_ids))
        )
        total_messages = msg_result.scalar() or 0

        # Messages today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id.in_(conv_ids),
                Message.created_at >= today_start,
            )
        )
        messages_today = today_result.scalar() or 0

    return UsageStats(
        total_chatbots=total_chatbots,
        total_documents=total_documents,
        total_embeddings=total_embeddings,
        total_conversations=total_conversations,
        total_messages=total_messages,
        messages_today=messages_today,
    )
