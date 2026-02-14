"""Google Sheets management routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.schemas.schemas import GoogleSheetCreate, GoogleSheetResponse
from app.models.chatbot import Chatbot
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.services.gsheet_service import (
    add_google_sheet, get_google_sheets, remove_google_sheet, sync_sheet,
)
from app.models.google_sheet import GoogleSheet

router = APIRouter(prefix="/api/chatbots/{chatbot_id}/gsheets", tags=["Google Sheets"])


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


@router.post("/", response_model=GoogleSheetResponse, status_code=status.HTTP_201_CREATED)
async def add_sheet(
    chatbot_id: str,
    data: GoogleSheetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)

    try:
        sheet = await add_google_sheet(
            db, chatbot_id, data.sheet_url, data.sheet_name
        )
        return sheet
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add Google Sheet: {str(e)}")


@router.get("/", response_model=list[GoogleSheetResponse])
async def list_sheets(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)
    sheets = await get_google_sheets(db, chatbot_id)
    return sheets


@router.post("/{sheet_id}/sync", response_model=GoogleSheetResponse)
async def sync_google_sheet(
    chatbot_id: str,
    sheet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)

    result = await db.execute(
        select(GoogleSheet).where(
            GoogleSheet.id == sheet_id,
            GoogleSheet.chatbot_id == chatbot_id,
        )
    )
    sheet = result.scalar_one_or_none()
    if not sheet:
        raise HTTPException(status_code=404, detail="Google Sheet not found")

    try:
        await sync_sheet(db, sheet)
        return sheet
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.delete("/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sheet(
    chatbot_id: str,
    sheet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_chatbot_ownership(chatbot_id, current_user, db)

    deleted = await remove_google_sheet(db, sheet_id, chatbot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Google Sheet not found")
