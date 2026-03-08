"""
JWT authentication middleware (Now using Firebase Auth).
Provides a FastAPI dependency for protecting routes.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import firebase_admin.auth as firebase_auth

from app.database import get_db
from app.services.auth_service import get_user_by_email, get_or_create_google_user
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that validates Firebase ID Token and returns the current user."""
    token = credentials.credentials
    
    try:
        # Verify the token using Firebase Admin SDK
        payload = firebase_auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing email",
        )

    # Find the user in our local PostgreSQL database
    user = await get_user_by_email(db, email)
    
    if not user:
        # First time login with Firebase syncs them into our local DB
        name = payload.get("name") or email.split("@")[0]
        user = await get_or_create_google_user(db, email, name)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )

    return user
