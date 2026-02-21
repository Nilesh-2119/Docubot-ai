"""Auth routes: register, login, refresh, me."""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse, TokenRefresh, UserResponse
from app.services.auth_service import (
    create_user, authenticate_user, get_user_by_email,
    create_access_token, create_refresh_token, decode_token, get_user_by_id,
)
from app.middleware.auth_middleware import get_current_user
from app.middleware.rate_limiter import auth_limiter, check_rate_limit
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    check_rate_limit(auth_limiter, data.email, "registration attempts")

    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = await create_user(db, data.email, data.password, data.full_name)
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    check_rate_limit(auth_limiter, data.email, "login attempts")

    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = await get_user_by_id(db, payload.get("sub"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Google Login Endpoints

from app.services.google_auth_service import google_auth_service, LOGIN_SCOPES
from app.services.auth_service import get_or_create_google_user
from app.config import get_settings

settings = get_settings()

@router.get("/google/login/url")
async def get_google_login_url():
    """Get Google OAuth URL for Login"""
    # Redirect to Frontend Callback
    callback_url = f"{settings.APP_URL}/auth/callback" 
    return {"url": google_auth_service.get_authorization_url(callback_url, scopes=LOGIN_SCOPES)}


@router.post("/google/login", response_model=TokenResponse)
async def google_login(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """Handle Google Login Code Exchange"""
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing auth code")

    # Must match the URL used to generate the code
    callback_url = f"{settings.APP_URL}/auth/callback"
    
    try:
        token_data = google_auth_service.exchange_code_for_token(code, callback_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Auth Failed: {e}")
        
    email = token_data.get("email")
    name = token_data.get("name")
    
    if not email:
        raise HTTPException(status_code=400, detail="No email provided by Google")
        
    # Get or create user
    user = await get_or_create_google_user(db, email, name)
    
    # Issue JWT
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

