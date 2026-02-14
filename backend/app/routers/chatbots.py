"""Chatbot CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.schemas.schemas import ChatbotCreate, ChatbotUpdate, ChatbotResponse
from app.models.chatbot import Chatbot
from app.models.document import Document
from app.models.embedding import Embedding
from app.models.user import User
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/chatbots", tags=["Chatbots"])


@router.get("/", response_model=list[ChatbotResponse])
async def list_chatbots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chatbot).where(Chatbot.user_id == current_user.id).order_by(Chatbot.created_at.desc())
    )
    chatbots = list(result.scalars().all())

    # Enrich with counts
    response = []
    for bot in chatbots:
        doc_count = await db.execute(
            select(func.count(Document.id)).where(Document.chatbot_id == bot.id)
        )
        emb_count = await db.execute(
            select(func.count(Embedding.id)).where(Embedding.chatbot_id == bot.id)
        )
        response.append(ChatbotResponse(
            id=bot.id,
            name=bot.name,
            description=bot.description,
            system_prompt=bot.system_prompt,
            status=bot.status.value if hasattr(bot.status, 'value') else bot.status,
            created_at=bot.created_at,
            document_count=doc_count.scalar() or 0,
            embedding_count=emb_count.scalar() or 0,
        ))

    return response


@router.post("/", response_model=ChatbotResponse, status_code=status.HTTP_201_CREATED)
async def create_chatbot(
    data: ChatbotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chatbot = Chatbot(
        user_id=current_user.id,
        name=data.name,
        description=data.description or "",
        system_prompt=data.system_prompt or Chatbot.system_prompt.default.arg,
    )
    db.add(chatbot)
    await db.flush()

    return ChatbotResponse(
        id=chatbot.id,
        name=chatbot.name,
        description=chatbot.description,
        system_prompt=chatbot.system_prompt,
        status=chatbot.status.value if hasattr(chatbot.status, 'value') else chatbot.status,
        created_at=chatbot.created_at,
        document_count=0,
        embedding_count=0,
    )


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
async def get_chatbot(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    doc_count = await db.execute(
        select(func.count(Document.id)).where(Document.chatbot_id == chatbot.id)
    )
    emb_count = await db.execute(
        select(func.count(Embedding.id)).where(Embedding.chatbot_id == chatbot.id)
    )

    return ChatbotResponse(
        id=chatbot.id,
        name=chatbot.name,
        description=chatbot.description,
        system_prompt=chatbot.system_prompt,
        status=chatbot.status.value if hasattr(chatbot.status, 'value') else chatbot.status,
        created_at=chatbot.created_at,
        document_count=doc_count.scalar() or 0,
        embedding_count=emb_count.scalar() or 0,
    )


@router.patch("/{chatbot_id}", response_model=ChatbotResponse)
async def update_chatbot(
    chatbot_id: str,
    data: ChatbotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    if data.name is not None:
        chatbot.name = data.name
    if data.description is not None:
        chatbot.description = data.description
    if data.system_prompt is not None:
        chatbot.system_prompt = data.system_prompt

    await db.flush()

    return ChatbotResponse(
        id=chatbot.id,
        name=chatbot.name,
        description=chatbot.description,
        system_prompt=chatbot.system_prompt,
        status=chatbot.status.value if hasattr(chatbot.status, 'value') else chatbot.status,
        created_at=chatbot.created_at,
    )


@router.delete("/{chatbot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chatbot(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == current_user.id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")

    await db.delete(chatbot)
    await db.flush()
