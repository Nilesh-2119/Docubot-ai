import asyncio
import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, Base
# Import all models to ensure they are registered in Base.metadata
from app.models import User, Chatbot, Document, Embedding, GoogleSheet, ExcelRow, GoogleIntegration

async def migrate():
    print("Starting migration...")
    async with engine.begin() as conn:
        # 1. Create any new tables (GoogleIntegration)
        print("Creating new tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        # 2. Alter GoogleSheet
        print("Altering google_sheets...")
        try:
            await conn.execute(text("ALTER TABLE google_sheets ADD COLUMN spreadsheet_id VARCHAR(255)"))
            print("  - Added spreadsheet_id")
        except Exception as e:
            print(f"  - spreadsheet_id already exists or error: {e}")

        try:
            await conn.execute(text("ALTER TABLE google_sheets ADD COLUMN access_mode VARCHAR(20) DEFAULT 'public'"))
            print("  - Added access_mode")
        except Exception as e:
            print(f"  - access_mode already exists or error: {e}")

        # 3. Alter ExcelRow
        print("Altering excel_rows...")
        try:
            await conn.execute(text("ALTER TABLE excel_rows ADD COLUMN google_sheet_id VARCHAR REFERENCES google_sheets(id) ON DELETE CASCADE"))
            print("  - Added google_sheet_id")
        except Exception as e:
            print(f"  - google_sheet_id already exists or error: {e}")

        try:
            await conn.execute(text("ALTER TABLE excel_rows ADD COLUMN source_type VARCHAR(50) DEFAULT 'excel'"))
            print("  - Added source_type")
        except Exception as e:
            print(f"  - source_type already exists or error: {e}")

        try:
            await conn.execute(text("ALTER TABLE excel_rows ALTER COLUMN document_id DROP NOT NULL"))
            print("  - Made document_id nullable")
        except Exception as e:
            print(f"  - document_id alter error: {e}")

    print("Migration complete.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        asyncio.run(migrate())
    except Exception as e:
        print(f"Migration Failed: {e}")
        import traceback
        traceback.print_exc()
