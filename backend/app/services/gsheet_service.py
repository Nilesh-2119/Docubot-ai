"""
Google Sheets service.
Fetches public Google Sheets as CSV, parses with column headers,
and creates embeddings for RAG.
Also populates ExcelRow table for structured SQL querying.
"""
import csv
import hashlib
import io
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.google_sheet import GoogleSheet
from app.models.embedding import Embedding
from app.models.excel_row import ExcelRow
from app.services.embedding_service import get_embeddings
from app.utils.text_chunker import chunk_text


def extract_sheet_id(url: str) -> str:
    """Extract the Google Sheet ID from various URL formats."""
    patterns = [
        r'/spreadsheets/d/([a-zA-Z0-9_-]+)',
        r'key=([a-zA-Z0-9_-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError("Invalid Google Sheets URL. Please provide a valid Google Sheets link.")


def extract_gid(url: str) -> str:
    """Extract the gid (sheet tab ID) from URL, default to 0."""
    match = re.search(r'gid=(\d+)', url)
    return match.group(1) if match else "0"


async def fetch_sheet_csv(url: str) -> str:
    """Fetch a public Google Sheet as CSV text."""
    sheet_id = extract_sheet_id(url)
    gid = extract_gid(url)
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(export_url)
    except httpx.ConnectError:
        raise ValueError(
            "Could not connect to Google Sheets. Check your internet connection."
        )
    except httpx.TimeoutException:
        raise ValueError(
            "Request to Google Sheets timed out. Please try again."
        )

    if response.status_code != 200:
        raise ValueError(
            "Failed to fetch Google Sheet. Make sure the sheet is shared as "
            "'Anyone with the link can view'."
        )

    # Google returns 200 with HTML login page for non-public sheets
    content_type = response.headers.get("content-type", "")
    body = response.text

    if "text/html" in content_type or body.strip().startswith("<!DOCTYPE") or "<html" in body[:500].lower():
        raise ValueError(
            "Google returned an HTML page instead of CSV data. "
            "This usually means the sheet is not publicly shared. "
            "Please set sharing to 'Anyone with the link can view'."
        )

    if not body.strip():
        raise ValueError("The Google Sheet appears to be empty.")

    return body


def _try_parse_numeric(value: str):
    """Try to convert string value to int or float for JSONB storage."""
    if not value or not value.strip():
        return value
    v = value.strip()
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        pass
    return value


def parse_csv_to_structured_rows(csv_text: str) -> List[Dict[str, Any]]:
    """Parse CSV text into list of {row_number, row_data} dicts for SQL storage."""
    rows = []
    reader = csv.reader(io.StringIO(csv_text))
    headers = []

    for row_num, row in enumerate(reader, start=1):
        values = [cell.strip() for cell in row]

        # Header row
        if row_num == 1:
            headers = [v if v else f"Column{i+1}" for i, v in enumerate(values)]
            continue

        # Skip empty rows
        if not any(v for v in values):
            continue

        row_data = {}
        for header, value in zip(headers, values):
            row_data[header] = _try_parse_numeric(value)

        rows.append({
            "row_number": row_num,
            "row_data": row_data
        })
    return rows


def parse_csv_with_headers(csv_text: str) -> str:
    """Parse CSV text and format each row with column headers for RAG."""
    reader = csv.reader(io.StringIO(csv_text))
    lines = []
    headers = []

    for row_num, row in enumerate(reader, start=1):
        values = [cell.strip() for cell in row]

        if row_num == 1:
            headers = [v if v else f"Column{i+1}" for i, v in enumerate(values)]
            lines.append("Columns: " + " | ".join(headers))
            continue

        pairs = []
        for header, value in zip(headers, values):
            if value:
                pairs.append(f"{header}: {value}")
        if pairs:
            lines.append(f"[Row {row_num}] " + " | ".join(pairs))

    return "\n".join(lines)


def compute_hash(text: str) -> str:
    """Compute SHA-256 hash of text for change detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def add_google_sheet(
    db: AsyncSession,
    chatbot_id: str,
    sheet_url: str,
    sheet_name: Optional[str] = None,
) -> GoogleSheet:
    """Add a Google Sheet source, fetch data, creating both embeddings AND structured rows."""
    # Validate URL
    extract_sheet_id(sheet_url)

    # Fetch CSV
    csv_text = await fetch_sheet_csv(sheet_url)
    if not csv_text.strip():
        raise ValueError("The Google Sheet appears to be empty.")

    # Parse and format
    formatted_text = parse_csv_with_headers(csv_text)
    data_hash = compute_hash(formatted_text)

    # Create sheet record
    sheet = GoogleSheet(
        chatbot_id=chatbot_id,
        sheet_url=sheet_url,
        sheet_name=sheet_name or "Google Sheet",
        status="syncing",
    )
    db.add(sheet)
    await db.flush()

    try:
        # 1. PROCESS EMBEDDINGS (Semantic Search)
        chunks = chunk_text(formatted_text)
        batch_size = 50
        all_embeddings = []
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            batch_embeddings = await get_embeddings(batch)
            all_embeddings.extend(batch_embeddings)

        for i, (chunk, emb) in enumerate(zip(chunks, all_embeddings)):
            embedding_record = Embedding(
                chatbot_id=chatbot_id,
                source_id=sheet.id,
                content=chunk,
                embedding=emb,
                metadata_json=f'{{"chunk_index": {i}, "source": "gsheet:{sheet.sheet_name}"}}',
            )
            db.add(embedding_record)

        # 2. PROCESS STRUCTURED ROWS (SQL Querying)
        structured_rows = parse_csv_to_structured_rows(csv_text)
        for row in structured_rows:
            db.add(ExcelRow(
                chatbot_id=chatbot_id,
                google_sheet_id=sheet.id,
                source_type="google_sheet",
                sheet_name=sheet.sheet_name,
                row_number=row["row_number"],
                row_data=row["row_data"]
            ))

        sheet.status = "ready"
        sheet.last_synced_at = datetime.utcnow()
        sheet.last_data_hash = data_hash
        await db.flush()

    except Exception as e:
        sheet.status = "error"
        await db.flush()
        raise e

    return sheet


async def sync_sheet(db: AsyncSession, sheet: GoogleSheet) -> bool:
    """Sync a Google Sheet — re-embed and re-populate rows only if data changed."""
    try:
        csv_text = await fetch_sheet_csv(sheet.sheet_url)
        if not csv_text.strip():
            sheet.status = "error"
            await db.flush()
            return False

        formatted_text = parse_csv_with_headers(csv_text)
        data_hash = compute_hash(formatted_text)

        # Skip if data hasn't changed
        if data_hash == sheet.last_data_hash:
            # Fix: Ensure status is set to ready (recovering from error state if needed)
            sheet.status = "ready"
            sheet.last_synced_at = datetime.utcnow()
            await db.flush()
            return False

        # Data changed — delete old data
        await db.execute(
            delete(Embedding).where(Embedding.source_id == sheet.id)
        )
        await db.execute(
            delete(ExcelRow).where(ExcelRow.google_sheet_id == sheet.id)
        )

        # 1. Re-create Embeddings
        chunks = chunk_text(formatted_text)
        batch_size = 50
        all_embeddings = []
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            batch_embeddings = await get_embeddings(batch)
            all_embeddings.extend(batch_embeddings)

        for i, (chunk, emb) in enumerate(zip(chunks, all_embeddings)):
            embedding_record = Embedding(
                chatbot_id=sheet.chatbot_id,
                source_id=sheet.id,
                content=chunk,
                embedding=emb,
                metadata_json=f'{{"chunk_index": {i}, "source": "gsheet:{sheet.sheet_name}"}}',
            )
            db.add(embedding_record)

        # 2. Re-create Structured Rows
        structured_rows = parse_csv_to_structured_rows(csv_text)
        for row in structured_rows:
            db.add(ExcelRow(
                chatbot_id=sheet.chatbot_id,
                google_sheet_id=sheet.id,
                source_type="google_sheet",
                sheet_name=sheet.sheet_name,
                row_number=row["row_number"],
                row_data=row["row_data"]
            ))

        sheet.status = "ready"
        sheet.last_synced_at = datetime.utcnow()
        sheet.last_data_hash = data_hash
        await db.flush()
        return True

    except Exception:
        sheet.status = "error"
        await db.flush()
        return False


async def get_google_sheets(db: AsyncSession, chatbot_id: str) -> list[GoogleSheet]:
    """Get all Google Sheets for a chatbot."""
    result = await db.execute(
        select(GoogleSheet)
        .where(GoogleSheet.chatbot_id == chatbot_id)
        .order_by(GoogleSheet.created_at.desc())
    )
    return list(result.scalars().all())


async def remove_google_sheet(db: AsyncSession, sheet_id: str, chatbot_id: str) -> bool:
    """Delete a Google Sheet, its embeddings, AND its structured rows."""
    result = await db.execute(
        select(GoogleSheet).where(
            GoogleSheet.id == sheet_id,
            GoogleSheet.chatbot_id == chatbot_id,
        )
    )
    sheet = result.scalar_one_or_none()
    if not sheet:
        return False

    # Delete embeddings
    await db.execute(
        delete(Embedding).where(Embedding.source_id == sheet.id)
    )

    # Delete structured rows
    await db.execute(
        delete(ExcelRow).where(ExcelRow.google_sheet_id == sheet.id)
    )

    # Delete sheet record
    await db.delete(sheet)
    await db.flush()
    return True

