"""
Background scheduler service.
Handles periodic tasks like syncing Google Sheets.
"""
import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.google_sheet import GoogleSheet
from app.services.gsheet_service import sync_sheet

async def background_sync_sheets():
    """
    Background task: sync all Google Sheets every 15 seconds.
    Ignores sync_interval_minutes for now as per user request for rapid updates.
    """
    print("🔄 Scheduler: Starting Google Sheets background sync (every 15s)")
    
    while True:
        try:
            async with async_session() as db:
                # Find sheets that are ready or in error state (to retry)
                # We currently only auto-sync public sheets or those where we have tokens (future)
                # For now, the system supports public sheets mainly.
                result = await db.execute(
                    select(GoogleSheet).where(
                        GoogleSheet.status.in_(["ready", "error"]),
                        GoogleSheet.access_mode != "oauth"  # Only sync public sheets automatically for now
                    )
                )
                sheets = result.scalars().all()
                
                if sheets:
                    print(f"🔄 Scheduler: Checking {len(sheets)} sheets for updates...")
                
                for sheet in sheets:
                    try:
                        updated = await sync_sheet(db, sheet)
                        if updated:
                            print(f"✅ Scheduler: Synced sheet '{sheet.sheet_name}'")
                    except Exception as e:
                        print(f"⚠️ Scheduler: Failed to sync sheet '{sheet.sheet_name}': {e}")
                
                await db.commit()
                
        except Exception as e:
            print(f"⚠️ Scheduler: Critical error in sync loop: {e}")
            
        # Wait 15 seconds before next run
        await asyncio.sleep(15)
