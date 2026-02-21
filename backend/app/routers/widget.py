"""Public widget chat endpoint (no auth, bot-id based)."""
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.schemas.schemas import WidgetChatMessage
from app.models.chatbot import Chatbot
from app.services.rag_service import process_chat_message, process_chat_message_stream
from app.utils.sanitizer import sanitize_input, check_prompt_injection
from app.middleware.rate_limiter import chat_limiter, check_rate_limit

router = APIRouter(prefix="/api/widget", tags=["Widget"])


@router.post("/{bot_id}/chat")
async def widget_chat(
    request: Request,
    bot_id: str,
    data: WidgetChatMessage,
    db: AsyncSession = Depends(get_db),
):
    """Public chat endpoint for embedded widget — no auth required."""
    client_ip = request.headers.get("x-forwarded-for") or request.client.host
    await check_rate_limit(chat_limiter, f"widget_{bot_id}_{client_ip}", "messages")

    # Verify bot exists and is active
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == bot_id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    # Sanitize input
    message = sanitize_input(data.message)
    if check_prompt_injection(message):
        raise HTTPException(status_code=400, detail="Message contains disallowed content")

    try:
        response = await process_chat_message(
            db, bot_id, message,
            session_id=data.session_id,
            source="widget",
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.post("/{bot_id}/chat/stream")
async def widget_chat_stream(
    request: Request,
    bot_id: str,
    data: WidgetChatMessage,
    db: AsyncSession = Depends(get_db),
):
    """Public streaming chat endpoint for embedded widget."""
    client_ip = request.headers.get("x-forwarded-for") or request.client.host
    await check_rate_limit(chat_limiter, f"widget_{bot_id}_{client_ip}", "messages")

    result = await db.execute(
        select(Chatbot).where(Chatbot.id == bot_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chatbot not found")

    message = sanitize_input(data.message)
    if check_prompt_injection(message):
        raise HTTPException(status_code=400, detail="Message contains disallowed content")

    async def event_stream():
        try:
            async for chunk in process_chat_message_stream(
                db, bot_id, message,
                session_id=data.session_id,
                source="widget",
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


@router.get("/{bot_id}/info")
async def widget_bot_info(
    bot_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get basic bot info for the widget."""
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == bot_id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    return {
        "id": chatbot.id,
        "name": chatbot.name,
        "description": chatbot.description,
    }
