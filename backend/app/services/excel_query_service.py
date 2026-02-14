"""
Excel Query Service — structured SQL path for Excel/CSV data.

Handles:
1. Intent detection (AGGREGATION, ROW_LOOKUP, SEMANTIC)
2. Schema extraction from JSONB rows
3. SQL generation via LLM
4. SQL validation (safety)
5. Safe query execution
6. Response formatting

This ONLY fires for chatbots with Excel/CSV documents.
PDF/DOCX/TXT chatbots bypass this entirely.
"""
import re
import json
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func

from app.config import get_settings
from app.models.excel_row import ExcelRow
from app.services.llm_service import chat_completion

settings = get_settings()


# ──────────────────────────────────────────────────
#  INTENT DETECTION (rule-based, no LLM cost)
# ──────────────────────────────────────────────────

AGGREGATION_KEYWORDS = [
    "how many", "count", "total", "sum", "average", "avg",
    "maximum", "minimum", "max", "min", "group by", "grouped",
    "percentage", "percent", "%", "number of",
]

ROW_LOOKUP_KEYWORDS = [
    "find", "where", "which", "who has", "who have", "lookup",
    "show me row", "show me rows", "get row", "get rows",
    "list all", "list the", "give me", "show all", "what is the",
    "details of", "details for", "information about", "info about",
]


def detect_intent(question: str) -> str:
    """
    Classify user question into: AGGREGATION, ROW_LOOKUP, or SEMANTIC.
    Rule-based — no LLM call, zero latency, zero cost.
    """
    q = question.lower().strip()

    # Check aggregation first (higher priority)
    for kw in AGGREGATION_KEYWORDS:
        if kw in q:
            return "AGGREGATION"

    # Check row lookup
    for kw in ROW_LOOKUP_KEYWORDS:
        if kw in q:
            return "ROW_LOOKUP"

    # Default: semantic → falls back to existing RAG
    return "SEMANTIC"


# ──────────────────────────────────────────────────
#  CHECK IF CHATBOT HAS EXCEL DATA
# ──────────────────────────────────────────────────

async def check_has_excel_data(db: AsyncSession, chatbot_id: str) -> bool:
    """Check if this chatbot has any ExcelRow records."""
    result = await db.execute(
        select(func.count(ExcelRow.id))
        .where(ExcelRow.chatbot_id == chatbot_id)
        .limit(1)
    )
    count = result.scalar() or 0
    return count > 0


# ──────────────────────────────────────────────────
#  SCHEMA EXTRACTION
# ──────────────────────────────────────────────────

async def get_excel_schema(db: AsyncSession, chatbot_id: str) -> dict:
    """
    Extract schema from stored ExcelRow JSONB data.
    Returns: { "columns": [{"name": "Col1", "type": "text"}, ...], "row_count": N }
    """
    # Get one sample row to infer column names + types
    result = await db.execute(
        select(ExcelRow.row_data)
        .where(ExcelRow.chatbot_id == chatbot_id)
        .limit(1)
    )
    sample = result.scalar()
    if not sample:
        return {"columns": [], "row_count": 0}

    # Count total rows
    count_result = await db.execute(
        select(func.count(ExcelRow.id))
        .where(ExcelRow.chatbot_id == chatbot_id)
    )
    row_count = count_result.scalar() or 0

    # Infer column types from sample data
    columns = []
    for key, value in sample.items():
        if isinstance(value, int):
            col_type = "integer"
        elif isinstance(value, float):
            col_type = "numeric"
        else:
            col_type = "text"
        columns.append({"name": key, "type": col_type})

    return {"columns": columns, "row_count": row_count}


# ──────────────────────────────────────────────────
#  SQL GENERATION (via LLM)
# ──────────────────────────────────────────────────

SQL_GENERATION_PROMPT = """You are a PostgreSQL query generator. Generate a single SELECT query to answer the user's question.

TABLE: excel_rows
- Each row has a JSONB column called `row_data` containing the actual data.
- You MUST access column values using: row_data->>'ColumnName' for text, or (row_data->>'ColumnName')::numeric for numbers.
- The table also has: chatbot_id (text), document_id (text), sheet_name (text), row_number (integer).

SCHEMA (columns inside row_data):
{schema}

TOTAL ROWS: {row_count}

RULES:
1. Generate ONLY a single SELECT statement.
2. Always include WHERE chatbot_id = :chatbot_id
3. Use row_data->>'ColumnName' for text comparisons (case-insensitive with ILIKE when appropriate).
4. Use (row_data->>'ColumnName')::numeric for numeric operations (SUM, COUNT, AVG, MAX, MIN).
5. For COUNT queries, use COUNT(*) with appropriate WHERE filters.
6. For listing queries, select the relevant row_data fields.
7. Add LIMIT 100 for row listing queries.
8. Do NOT use INSERT, UPDATE, DELETE, DROP, ALTER, or TRUNCATE.
9. Do NOT use subqueries or JOINs.
10. Return ONLY the SQL query, nothing else. No markdown, no explanation.

USER QUESTION: {question}

SQL:"""


async def generate_sql(
    question: str,
    schema: dict,
    intent: str,
) -> str:
    """Generate a safe SELECT SQL query via LLM."""
    schema_str = "\n".join(
        f"  - {col['name']} ({col['type']})"
        for col in schema["columns"]
    )

    prompt = SQL_GENERATION_PROMPT.format(
        schema=schema_str,
        row_count=schema["row_count"],
        question=question,
    )

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": question},
    ]

    sql = await chat_completion(messages, temperature=0.0)

    # Clean up: remove markdown code fences if present
    sql = sql.strip()
    if sql.startswith("```"):
        sql = re.sub(r'^```\w*\n?', '', sql)
        sql = re.sub(r'\n?```$', '', sql)
    sql = sql.strip()

    return sql


# ──────────────────────────────────────────────────
#  SQL VALIDATION (safety)
# ──────────────────────────────────────────────────

FORBIDDEN_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE",
    "INTO", "--", "/*",
]


def validate_sql(sql: str) -> tuple[bool, str]:
    """
    Validate generated SQL for safety.
    Returns: (is_valid, error_message)
    """
    if not sql or not sql.strip():
        return False, "Empty SQL query"

    sql_upper = sql.upper().strip()

    # Must start with SELECT
    if not sql_upper.startswith("SELECT"):
        return False, "Query must start with SELECT"

    # Reject multiple statements
    # Split by semicolons, filter out empty strings
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    if len(statements) > 1:
        return False, "Multiple statements not allowed"

    # Check forbidden keywords (outside of string literals)
    for keyword in FORBIDDEN_KEYWORDS:
        # Use word boundary check to avoid false positives
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, sql_upper):
            return False, f"Forbidden keyword: {keyword}"

    # Must reference chatbot_id for multi-tenant safety
    if "chatbot_id" not in sql.lower():
        return False, "Query must include chatbot_id filter"

    return True, ""


# ──────────────────────────────────────────────────
#  SAFE QUERY EXECUTION
# ──────────────────────────────────────────────────

async def execute_safe_query(
    db: AsyncSession,
    sql: str,
    chatbot_id: str,
) -> list[dict]:
    """
    Execute a validated SQL query with chatbot_id parameter.
    Always adds LIMIT safeguard.
    """
    # Add LIMIT if not already present
    if "LIMIT" not in sql.upper():
        sql = sql.rstrip().rstrip(";") + " LIMIT 1000"

    result = await db.execute(
        text(sql),
        {"chatbot_id": chatbot_id}
    )

    rows = result.fetchall()
    columns = result.keys()

    return [dict(zip(columns, row)) for row in rows]


# ──────────────────────────────────────────────────
#  RESPONSE FORMATTING (via LLM)
# ──────────────────────────────────────────────────

async def format_sql_response(
    question: str,
    sql_result: list[dict],
    intent: str,
) -> str:
    """
    Format SQL query result into a natural language response.
    Uses LLM with low temperature for factual formatting.
    """
    if not sql_result:
        return "I couldn't find any matching data for your question."

    # For simple aggregation (single value), return directly
    if intent == "AGGREGATION" and len(sql_result) == 1 and len(sql_result[0]) == 1:
        key = list(sql_result[0].keys())[0]
        value = sql_result[0][key]
        # Let LLM format it nicely
        result_str = json.dumps(sql_result, default=str)
    else:
        result_str = json.dumps(sql_result, default=str, indent=2)

    prompt = f"""You are a data assistant. The user asked a question and here is the exact result from the database.

USER QUESTION: {question}

DATABASE RESULT:
{result_str}

RULES:
- Report the exact values from the result. Do NOT modify, round, or approximate any numbers.
- If it's a count/total, state the number clearly.
- If it's a list of rows, format them in a readable way.
- Do NOT add information not present in the result.
- Be concise and direct.
- Do NOT mention SQL, databases, or queries in your response."""

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": question},
    ]

    return await chat_completion(messages, temperature=0.2)


# ──────────────────────────────────────────────────
#  MAIN ENTRY POINT
# ──────────────────────────────────────────────────

async def process_excel_query(
    db: AsyncSession,
    chatbot_id: str,
    question: str,
) -> Optional[str]:
    """
    Process a question against Excel/CSV data using SQL.

    Returns:
        str: Answer text if SQL path succeeded
        None: If intent is SEMANTIC or SQL fails → caller falls back to RAG
    """
    # Step 1: Detect intent
    intent = detect_intent(question)

    if settings.RAG_DEBUG:
        print(f"🔍 [EXCEL SQL] Intent: {intent} | Question: {question}")

    if intent == "SEMANTIC":
        return None  # Fall back to existing RAG

    # Step 2: Get schema
    schema = await get_excel_schema(db, chatbot_id)
    if not schema["columns"]:
        return None

    if settings.RAG_DEBUG:
        print(f"🔍 [EXCEL SQL] Schema: {len(schema['columns'])} columns, {schema['row_count']} rows")

    # Step 3: Generate SQL
    try:
        sql = await generate_sql(question, schema, intent)
    except Exception as e:
        if settings.RAG_DEBUG:
            print(f"🔍 [EXCEL SQL] SQL generation failed: {e}")
        return None

    if settings.RAG_DEBUG:
        print(f"🔍 [EXCEL SQL] Generated SQL: {sql}")

    # Step 4: Validate SQL
    is_valid, error = validate_sql(sql)
    if not is_valid:
        if settings.RAG_DEBUG:
            print(f"🔍 [EXCEL SQL] Validation failed: {error}")
        return None  # Fall back to RAG

    # Step 5: Execute query
    try:
        result = await execute_safe_query(db, sql, chatbot_id)
    except Exception as e:
        if settings.RAG_DEBUG:
            print(f"🔍 [EXCEL SQL] Execution failed: {e}")
        return None  # Fall back to RAG

    if settings.RAG_DEBUG:
        print(f"🔍 [EXCEL SQL] Result rows: {len(result)}")

    # Step 6: Format response
    try:
        response = await format_sql_response(question, result, intent)
        return response
    except Exception as e:
        if settings.RAG_DEBUG:
            print(f"🔍 [EXCEL SQL] Response formatting failed: {e}")
        return None
