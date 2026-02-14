"""
DocuBot AI - FastAPI Backend
Production-ready SaaS application for document-based AI chatbots.
"""
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, async_session
from app.routers import auth, chatbots, documents, chat, widget, webhooks, dashboard
from app.routers import gsheets

settings = get_settings()

# Background sync task handle
_sync_task = None


async def background_sync_sheets():
    """Background task: sync all Google Sheets every 5 minutes."""
    from app.models.google_sheet import GoogleSheet
    from app.services.gsheet_service import sync_sheet
    from sqlalchemy import select

    while True:
        await asyncio.sleep(300)  # 5 minutes
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(GoogleSheet).where(GoogleSheet.status.in_(["ready", "error"]))
                )
                sheets = result.scalars().all()
                for sheet in sheets:
                    try:
                        await sync_sheet(db, sheet)
                    except Exception as e:
                        print(f"⚠️ Failed to sync sheet {sheet.sheet_name}: {e}")
                await db.commit()
        except Exception as e:
            print(f"⚠️ Background sync error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global _sync_task
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await init_db()
    print("✅ Database initialized")
    print("✅ DocuBot AI Backend ready")

    # Start background sync
    _sync_task = asyncio.create_task(background_sync_sheets())
    print("🔄 Google Sheets background sync started (every 5 min)")

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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.APP_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "*",  # Allow widget embeds from any origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(chatbots.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(widget.router)
app.include_router(webhooks.router)
app.include_router(dashboard.router)
app.include_router(gsheets.router)


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
