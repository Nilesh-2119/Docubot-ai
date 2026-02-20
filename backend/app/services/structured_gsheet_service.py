import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

from app.models.excel_row import ExcelRow
from app.models.google_sheet import GoogleSheet
from app.services.google_auth_service import google_auth_service
from app.models.user import User

logger = logging.getLogger(__name__)


async def fetch_sheet_values(
    creds: Credentials,
    spreadsheet_id: str,
    range_: str = "A:Z"
) -> List[List[Any]]:
    """Fetch values from a Google Sheet."""
    try:
        service = build('sheets', 'v4', credentials=creds, cache_discovery=False)
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=spreadsheet_id, range=range_).execute()
        return result.get('values', [])
    except Exception as e:
        logger.error(f"Failed to fetch Google Sheet data: {e}")
        raise ValueError(f"Failed to fetch Google Sheet data: {str(e)}")


def normalize_rows(raw_data: List[List[Any]]) -> List[Dict[str, Any]]:
    """
    Normalize raw sheet data into a list of dicts.
    - First row is header.
    - Trim whitespace.
    - numeric conversion.
    """
    if not raw_data:
        return []

    headers = [str(cell).strip() for cell in raw_data[0]]
    # Sanitize headers (remove empty, duplicates)
    sanitized_headers = []
    seen = set()
    for i, h in enumerate(headers):
        if not h:
            h = f"Column{i+1}"
        base_h = h
        counter = 1
        while h in seen:
            h = f"{base_h}_{counter}"
            counter += 1
        seen.add(h)
        sanitized_headers.append(h)

    rows = []
    for row_idx, row_values in enumerate(raw_data[1:], start=2):
        row_dict = {}
        # Skip empty rows
        if not any(str(cell).strip() for cell in row_values):
            continue

        for col_idx, header in enumerate(sanitized_headers):
            val = row_values[col_idx] if col_idx < len(row_values) else ""
            
            # Type inference
            if isinstance(val, str):
                val = val.strip()
                # Try int
                if val.isdigit():
                    val = int(val)
                else:
                    # Try float
                    try:
                        f_val = float(val)
                        if f_val.is_integer():
                            val = int(f_val)
                        else:
                            val = f_val
                    except ValueError:
                        pass
                        
            row_dict[header] = val
            
        rows.append(row_dict)
    
    return rows


async def sync_structured_sheet(
    db: AsyncSession,
    google_sheet: GoogleSheet,
    user_id: str
) -> int:
    """
    Sync a Google Sheet to ExcelRow table.
    1. Get valid credentials.
    2. Fetch data.
    3. Delete old rows.
    4. Insert new rows.
    Returns count of rows synced.
    """
    try:
        creds = await google_auth_service.get_valid_credentials(db, user_id)
        if not creds:
            raise ValueError("Google authentication required. Please connect your Google account.")

        if not google_sheet.spreadsheet_id:
            raise ValueError("Invalid spreadsheet ID.")

        # Fetch data
        raw_rows = await fetch_sheet_values(creds, google_sheet.spreadsheet_id)
        if not raw_rows:
            # Empty sheet?
            return 0
        
        normalized_rows = normalize_rows(raw_rows)
        
        # Transaction: Delete old rows -> Insert new
        # We delete by google_sheet_id
        await db.execute(
            delete(ExcelRow).where(ExcelRow.google_sheet_id == google_sheet.id)
        )
        
        new_row_objects = []
        for i, row_data in enumerate(normalized_rows):
            new_row_objects.append(ExcelRow(
                chatbot_id=google_sheet.chatbot_id,
                document_id=None, # It's a Google Sheet, not a file doc
                google_sheet_id=google_sheet.id,
                source_type="google_sheet",
                sheet_name=google_sheet.sheet_name,
                row_number=i+2, # +2 because 1-based and skipped header
                row_data=row_data
            ))
            
        if new_row_objects:
            db.add_all(new_row_objects)
            
        google_sheet.last_synced_at = datetime.utcnow()
        google_sheet.status = "ready"
        google_sheet.last_data_hash = "" # We don't use hash for now, or could compute it
        await db.commit()
        
        return len(new_row_objects)

    except Exception as e:
        logger.error(f"Sync failed for sheet {google_sheet.id}: {e}")
        google_sheet.status = "error"
        await db.commit() # Save error status
        raise e
