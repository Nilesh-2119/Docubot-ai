import os
# Allow OAuthlib to accept different scopes than requested (e.g. if user declines some)
# This prevents the "Scope has changed" error.
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.google_integration import GoogleIntegration

settings = get_settings()

# Scopes
LOGIN_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
]

SHEET_SCOPES = LOGIN_SCOPES + [
    'https://www.googleapis.com/auth/spreadsheets.readonly'
]


class GoogleAuthService:
    def __init__(self):
        # Use JWT_SECRET_KEY to derive a Fernet key?
        # Fernet require a 32-byte url-safe base64-encoded key.
        # Ideally we should have a separate ENCRYPTION_KEY env var.
        # Fallback: Hash JWT_SECRET to 32 bytes and base64 encode it.
        # For now, if no key provided, we'll use a deterministic one based on JWT_SECRET
        # (NOT SECURE FOR PRODUCTION IF JWT_SECRET IS WEAK/CHANGED)
        # TODO: Add ENCRYPTION_KEY to config.
        import base64
        import hashlib
        key = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
        self.fernet = Fernet(base64.urlsafe_b64encode(key))

    def encrypt_token(self, token: str) -> str:
        """Encrypt a token."""
        if not token:
            return ""
        return self.fernet.encrypt(token.encode()).decode()

    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt a token."""
        if not encrypted_token:
            return ""
        try:
            return self.fernet.decrypt(encrypted_token.encode()).decode()
        except Exception:
            return ""

    def get_authorization_url(self, redirect_uri: str, scopes: List[str] = None) -> str:
        """Generate the Google OAuth authorization URL."""
        target_scopes = scopes or LOGIN_SCOPES
        
        flow = Flow.from_client_config(
            self._get_client_config(),
            scopes=target_scopes
        )
        flow.redirect_uri = redirect_uri
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'  # Force consent to get refresh token
        )
        return authorization_url

    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange auth code for access and refresh tokens."""
        # We don't strictly know which scopes were granted yet, 
        # but OAUTHLIB_RELAX_TOKEN_SCOPE=1 handles mismatches.
        # We start with LOGIN_SCOPES as baseline.
        
        flow = Flow.from_client_config(
            self._get_client_config(),
            scopes=LOGIN_SCOPES 
        )
        flow.redirect_uri = redirect_uri
        
        # This will fetch the token. 
        # If user granted more scopes (e.g. sheets), it will be reflected in credentials.
        flow.fetch_token(code=code)

        
        credentials = flow.credentials
        
        # Get user info
        from googleapiclient.discovery import build
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()

        return {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "expires_in": 3600,  # approximate
            "google_user_id": user_info.get('id'),
            "email": user_info.get('email'),
            "name": user_info.get('name')
        }

    def _get_client_config(self) -> Dict[str, Any]:
        """Construct client config from settings."""
        return {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }

    async def get_valid_credentials(self, db: AsyncSession, user_id: str) -> Optional[Credentials]:
        """
        Get valid Google Credentials for a user.
        Refresh token if expired and update DB.
        """
        result = await db.execute(select(GoogleIntegration).where(GoogleIntegration.user_id == user_id))
        integration = result.scalar_one_or_none()
        
        if not integration:
            return None

        access_token = self.decrypt_token(integration.access_token)
        refresh_token = self.decrypt_token(integration.refresh_token) if integration.refresh_token else None

        if not access_token:
            return None

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=SCOPES
        )

        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Update DB with new access token
                integration.access_token = self.encrypt_token(creds.token)
                integration.token_expiry = datetime.utcnow() + timedelta(seconds=3600)
                await db.commit() # Commit handling should be by caller? 
                # Actually, modifying the object attached to session is fine, caller commits.
                # But here we might want to commit immediately to persist the refresh.
                # However, this function takes a session. It's safer to let caller commit.
                # But refreshing token is a side-effect.
                # Let's hope the caller commits. If not, we lose the refresh, which is okay (will refresh again next time).
            except Exception as e:
                print(f"Failed to refresh token: {e}")
                return None
        
        return creds

google_auth_service = GoogleAuthService()
