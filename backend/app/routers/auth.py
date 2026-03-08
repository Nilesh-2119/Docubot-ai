"""Auth routes: Firebase user verification."""
from fastapi import APIRouter, Depends
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user based on their Firebase ID token."""
    return current_user
