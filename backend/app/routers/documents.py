"""Document upload and management routes."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.schemas.schemas import DocumentResponse
from app.models.chatbot import Chatbot
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.middleware.rate_limiter import upload_limiter, check_rate_limit
from app.services.document_service import (
    upload_and_process_document, get_documents, delete_document, get_embedding_count,
)

router = APIRouter(prefix="/api/chatbots/{chatbot_id}/documents", tags=["Documents"])


async def verify_chatbot_ownership(
    chatbot_id: str, user: User, db: AsyncSession
) -> Chatbot:
    """Verify the user owns the chatbot."""
    result = await db.execute(
        select(Chatbot).where(Chatbot.id == chatbot_id, Chatbot.user_id == user.id)
    )
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    return chatbot


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    chatbot_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(upload_limiter, current_user.id, "uploads")
    await verify_chatbot_ownership(chatbot_id, current_user, db)

    try:
        doc = await upload_and_process_document(db, chatbot_id, file)
        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)
    documents = await get_documents(db, chatbot_id)
    return documents


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document(
    chatbot_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)

    deleted = await delete_document(db, document_id, chatbot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")


@router.get("/embeddings/count")
async def embedding_count(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)
    count = await get_embedding_count(db, chatbot_id)
    return {"count": count}
