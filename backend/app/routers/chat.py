"""Chat routes with streaming support + conversation history."""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db
from app.schemas.schemas import ChatMessage, ChatResponse
from app.models.chatbot import Chatbot
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.middleware.rate_limiter import chat_limiter, check_rate_limit
from app.services.rag_service import process_chat_message, process_chat_message_stream
from app.utils.sanitizer import sanitize_input, check_prompt_injection

router = APIRouter(prefix="/api/chatbots/{chatbot_id}/chat", tags=["Chat"])


@router.post("/", response_model=ChatResponse)
async def send_message(
    chatbot_id: str,
    data: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(chat_limiter, current_user.id, "messages")

    # Verify ownership
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Sanitize input
    message = sanitize_input(data.message)
    if check_prompt_injection(message):
        raise HTTPException(status_code=400, detail="Message contains disallowed content")

    try:
        response = await process_chat_message(
            db, chatbot_id, message, data.conversation_id
        )
        return ChatResponse(**response)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.post("/stream")
async def send_message_stream(
    chatbot_id: str,
    data: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(chat_limiter, current_user.id, "messages")

    # Verify ownership
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Sanitize input
    message = sanitize_input(data.message)
    if check_prompt_injection(message):
        raise HTTPException(status_code=400, detail="Message contains disallowed content")

    async def event_stream():
        try:
            async for chunk in process_chat_message_stream(
                db, chatbot_id, message, data.conversation_id
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────────────────────────────────
#  CONVERSATION HISTORY ENDPOINTS
# ──────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for a chatbot, with a preview of the first user message."""
    # Verify ownership
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Get conversations ordered by most recent
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.chatbot_id == chatbot_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = list(conv_result.scalars().all())

    # For each conversation, get the first user message as preview + message count
    items = []
    for conv in conversations:
        # Get first user message as title/preview
        first_msg_result = await db.execute(
            select(Message.content)
            .where(Message.conversation_id == conv.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = first_msg_result.scalar()

        # Get message count
        count_result = await db.execute(
            select(func.count(Message.id))
            .where(Message.conversation_id == conv.id)
        )
        msg_count = count_result.scalar() or 0

        items.append({
            "id": conv.id,
            "preview": (first_msg[:80] + "...") if first_msg and len(first_msg) > 80 else (first_msg or "Empty conversation"),
            "message_count": msg_count,
            "source": conv.source,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat(),
        })

    return items


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    chatbot_id: str,
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages for a specific conversation."""
    # Verify ownership
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Verify conversation belongs to this chatbot
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.chatbot_id == chatbot_id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get all messages ordered chronologically
    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = list(msg_result.scalars().all())

    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        }
        for msg in messages
    ]


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    chatbot_id: str,
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    # Verify ownership
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Find and delete conversation
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.chatbot_id == chatbot_id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)  # CASCADE deletes messages
    await db.flush()
    return {"status": "deleted"}

