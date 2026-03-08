"""
DocuBot AI - FastAPI Backend
Production-ready SaaS application for document-based AI chatbots.
"""
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials

from app.config import get_settings
from app.database import init_db, async_session
from app.routers import auth, chatbots, documents, chat, widget, webhooks, dashboard
from app.routers import gsheets

settings = get_settings()

# Background sync task handle
_sync_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global _sync_task
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await init_db()
    
    # Initialize Firebase Admin
    if settings.FIREBASE_CREDENTIALS:
        try:
            if settings.FIREBASE_CREDENTIALS.strip().startswith("{"):
                import json
                cred_dict = json.loads(settings.FIREBASE_CREDENTIALS)
                cred = credentials.Certificate(cred_dict)
            else:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
            firebase_admin.initialize_app(cred)
            print("🔥 Firebase Admin initialized")
        except Exception as e:
            print(f"⚠️ Failed to initialize Firebase Admin: {e}")
    else:
        try:
            firebase_admin.initialize_app()
            print("🔥 Firebase Admin initialized with default credentials")
        except Exception as e:
            print(f"⚠️ Firebase Admin not initialized: {e}")
    
    # Seed default plans
    from app.services.subscription_service import seed_default_plans
    async with async_session() as db:
        await seed_default_plans(db)
    
    # Start background scheduler
    from app.services.scheduler import background_sync_sheets
    _sync_task = asyncio.create_task(background_sync_sheets())
    print("✅ Background scheduler started")
    
    yield
    
    # Shutdown
    if _sync_task:
        _sync_task.cancel()
    print("👋 Shutting down DocuBot AI Backend")


app = FastAPI(
    title="DocuBot AI",
    description="AI chatbot platform powered by RAG — upload documents, get intelligent responses.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Security
from app.middleware.cors_middleware import SecureCORSMiddleware
app.add_middleware(SecureCORSMiddleware)

# Include routers
app.include_router(auth.router)
app.include_router(chatbots.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(widget.router)
app.include_router(webhooks.router)
app.include_router(dashboard.router)
app.include_router(gsheets.router)
from app.routers import google_auth
app.include_router(google_auth.router)
from app.routers import integrations
app.include_router(integrations.router)
from app.routers import whatsapp
app.include_router(whatsapp.router)
from app.routers import billing
app.include_router(billing.router)


@app.get("/")
async def root():
    return {
        "name": "DocuBot AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
