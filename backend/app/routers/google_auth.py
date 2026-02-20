from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.database import get_db
from app.services.google_auth_service import google_auth_service, SHEET_SCOPES
from app.models.google_integration import GoogleIntegration
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/auth/google", tags=["Google Auth"])
settings = get_settings()


@router.get("/url")
async def get_url(current_user: User = Depends(get_current_user)):
    """Get the Google OAuth authorization URL."""
    try:
        url = google_auth_service.get_authorization_url(
            settings.GOOGLE_REDIRECT_URI, 
            scopes=SHEET_SCOPES
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate URL: {str(e)}")


@router.post("/callback")
async def callback(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exchange auth code for tokens and save to DB."""
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing auth code")

    try:
        tokens = google_auth_service.exchange_code_for_token(code, settings.GOOGLE_REDIRECT_URI)
        
        # Check if integration exists
        result = await db.execute(
            select(GoogleIntegration).where(GoogleIntegration.user_id == current_user.id)
        )
        integration = result.scalar_one_or_none()
        
        if not integration:
            integration = GoogleIntegration(
                user_id=current_user.id,
                access_token="", # Placeholder
                refresh_token=""
            )
            db.add(integration)

        # Update tokens
        integration.access_token = google_auth_service.encrypt_token(tokens["access_token"])
        if tokens.get("refresh_token"):
            integration.refresh_token = google_auth_service.encrypt_token(tokens["refresh_token"])
            
        integration.google_user_id = tokens.get("google_user_id")
        # Approximate expiry
        integration.token_expiry = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        
        await db.commit()
        
        return {
            "status": "success", 
            "email": tokens.get("email"),
            "connected_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Auth failed: {str(e)}")


@router.get("/status")
async def get_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if user has connected Google account."""
    result = await db.execute(
        select(GoogleIntegration).where(GoogleIntegration.user_id == current_user.id)
    )
    integration = result.scalar_one_or_none()
    
    return {
        "connected": integration is not None,
        "email": None, # We don't store email in integration, but could if we want.
        # Ideally we fetch profile info or store it. 
        # For now just return boolean.
    }
