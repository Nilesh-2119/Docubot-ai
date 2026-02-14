"""
RAG (Retrieval Augmented Generation) service.

HYBRID ARCHITECTURE:
  Excel/CSV → SQL query path (via excel_query_service)
  PDF/DOCX/TXT → embedding-based RAG (unchanged)

The SQL path is an early return that only triggers when:
  1. The chatbot has Excel/CSV data (ExcelRow records exist)
  2. The intent is AGGREGATION or ROW_LOOKUP

For SEMANTIC questions or non-Excel chatbots, the full existing
RAG pipeline runs unchanged.
"""
import uuid
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from app.config import get_settings
from app.models.embedding import Embedding
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.chatbot import Chatbot
from app.services.embedding_service import get_single_embedding
from app.services.llm_service import chat_completion, chat_completion_stream, build_rag_prompt
from app.services.excel_query_service import check_has_excel_data, process_excel_query
from app.utils.text_chunker import count_tokens

settings = get_settings()


# ──────────────────────────────────────────────────
#  EMBEDDING-BASED RETRIEVAL (unchanged)
# ──────────────────────────────────────────────────

async def similarity_search(
    db: AsyncSession,
    chatbot_id: str,
    query_embedding: list[float],
    top_k: int = None,
    similarity_threshold: float = None,
) -> list[dict]:
    """
    Find top-K most similar chunks using pgvector cosine distance.
    Only used for PDF/DOCX/TXT documents.
    """
    top_k = top_k or settings.RAG_TOP_K
    similarity_threshold = similarity_threshold or settings.RAG_SIMILARITY_THRESHOLD

    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    fetch_limit = top_k * 2

    query = text(
        "SELECT id, content, metadata_json, "
        "1 - (embedding <=> CAST(:embedding AS vector)) as similarity "
        "FROM embeddings "
        "WHERE chatbot_id = :chatbot_id "
        "ORDER BY embedding <=> CAST(:embedding AS vector) "
        "LIMIT :fetch_limit"
    )

    result = await db.execute(
        query,
        {"embedding": embedding_str, "chatbot_id": chatbot_id, "fetch_limit": fetch_limit},
    )

    rows = result.fetchall()

    # Apply similarity threshold
    filtered = []
    for row in rows:
        sim = float(row[3])
        if sim >= similarity_threshold:
            filtered.append({
                "id": row[0],
                "content": row[1],
                "metadata": row[2],
                "similarity": sim,
            })

    # Adaptive top_k
    if filtered and filtered[0]["similarity"] > 0.75:
        adaptive_k = min(top_k, max(3, len(filtered)))
    else:
        adaptive_k = min(top_k, len(filtered))

    selected = filtered[:adaptive_k]

    # Token budget trimming
    max_context_tokens = settings.RAG_MAX_CONTEXT_TOKENS
    trimmed = []
    total_tokens = 0
    for chunk in selected:
        chunk_tokens = count_tokens(chunk["content"])
        if total_tokens + chunk_tokens > max_context_tokens:
            break
        trimmed.append(chunk)
        total_tokens += chunk_tokens

    if settings.RAG_DEBUG:
        print(f"🔍 [RAG] Candidates: {len(rows)} → threshold: {len(filtered)} → final: {len(trimmed)} ({total_tokens} tokens)")

    return trimmed


async def retrieve_context(
    db: AsyncSession,
    chatbot_id: str,
    user_message: str,
) -> list[dict]:
    """
    Retrieve context for RAG. Only used for non-Excel documents.
    Uses similarity search with embeddings.
    """
    query_embedding = await get_single_embedding(user_message)
    return await similarity_search(db, chatbot_id, query_embedding)


# ──────────────────────────────────────────────────
#  CONVERSATION MANAGEMENT (unchanged)
# ──────────────────────────────────────────────────

async def get_or_create_conversation(
    db: AsyncSession,
    chatbot_id: str,
    conversation_id: Optional[str] = None,
    session_id: Optional[str] = None,
    source: str = "web",
) -> Conversation:
    """Get existing conversation or create a new one."""
    if conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.chatbot_id == chatbot_id,
            )
        )
        conv = result.scalar_one_or_none()
        if conv:
            return conv

    conv = Conversation(
        chatbot_id=chatbot_id,
        session_id=session_id or str(uuid.uuid4()),
        source=source,
    )
    db.add(conv)
    await db.flush()
    return conv


async def get_chat_history(db: AsyncSession, conversation_id: str, limit: int = 10) -> list[dict]:
    """Get recent chat history for a conversation."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    return [{"role": m.role, "content": m.content} for m in messages]


# ──────────────────────────────────────────────────
#  MAIN PROCESSING (non-streaming)
# ──────────────────────────────────────────────────

async def process_chat_message(
    db: AsyncSession,
    chatbot_id: str,
    user_message: str,
    conversation_id: Optional[str] = None,
    session_id: Optional[str] = None,
    source: str = "web",
) -> dict:
    """Process a chat message through the hybrid RAG pipeline."""
    # Get chatbot
    result = await db.execute(select(Chatbot).where(Chatbot.id == chatbot_id))
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise ValueError("Chatbot not found")

    # Get or create conversation
    conversation = await get_or_create_conversation(
        db, chatbot_id, conversation_id, session_id, source
    )

    # ═══════════════════════════════════════════════════════
    #  SQL PATH — Excel/CSV data (early return)
    # ═══════════════════════════════════════════════════════
    has_excel = await check_has_excel_data(db, chatbot_id)
    if has_excel:
        excel_response = await process_excel_query(db, chatbot_id, user_message)
        if excel_response is not None:
            # SQL path succeeded — save messages and return
            user_msg = Message(
                conversation_id=conversation.id,
                role="user",
                content=user_message,
            )
            assistant_msg = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=excel_response,
            )
            db.add(user_msg)
            db.add(assistant_msg)
            await db.flush()

            return {
                "response": excel_response,
                "conversation_id": conversation.id,
                "sources": [{"content": "Excel/CSV structured query", "similarity": 1.0}],
            }
        # If excel_response is None → intent was SEMANTIC or SQL failed
        # Fall through to existing RAG path below

    # ═══════════════════════════════════════════════════════
    #  RAG PATH — PDF/DOCX/TXT (existing, unchanged)
    # ═══════════════════════════════════════════════════════
    similar_chunks = await retrieve_context(db, chatbot_id, user_message)
    context_chunks = [chunk["content"] for chunk in similar_chunks]

    chat_history = await get_chat_history(db, conversation.id)

    messages = build_rag_prompt(
        question=user_message,
        context_chunks=context_chunks,
        system_prompt=chatbot.system_prompt,
        chat_history=chat_history,
    )

    response_text = await chat_completion(messages)

    # Save messages
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.flush()

    return {
        "response": response_text,
        "conversation_id": conversation.id,
        "sources": [
            {"content": c["content"][:200], "similarity": c["similarity"]}
            for c in similar_chunks[:3]
        ],
    }


# ──────────────────────────────────────────────────
#  MAIN PROCESSING (streaming)
# ──────────────────────────────────────────────────

async def process_chat_message_stream(
    db: AsyncSession,
    chatbot_id: str,
    user_message: str,
    conversation_id: Optional[str] = None,
    session_id: Optional[str] = None,
    source: str = "web",
) -> AsyncGenerator[str, None]:
    """Process a chat message with streaming response."""
    # Get chatbot
    result = await db.execute(select(Chatbot).where(Chatbot.id == chatbot_id))
    chatbot = result.scalar_one_or_none()
    if not chatbot:
        raise ValueError("Chatbot not found")

    # Get or create conversation
    conversation = await get_or_create_conversation(
        db, chatbot_id, conversation_id, session_id, source
    )

    # ═══════════════════════════════════════════════════════
    #  SQL PATH — Excel/CSV data (early return, non-streaming)
    #  SQL queries are fast, so we return the full response
    #  as a single chunk rather than streaming.
    # ═══════════════════════════════════════════════════════
    has_excel = await check_has_excel_data(db, chatbot_id)
    if has_excel:
        excel_response = await process_excel_query(db, chatbot_id, user_message)
        if excel_response is not None:
            # Save messages
            user_msg = Message(
                conversation_id=conversation.id,
                role="user",
                content=user_message,
            )
            db.add(user_msg)
            await db.flush()

            # Yield conversation ID then full response
            yield f"__CONV_ID__{conversation.id}__END__"
            yield excel_response

            # Save assistant message
            assistant_msg = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=excel_response,
            )
            db.add(assistant_msg)
            await db.flush()
            return
        # Fall through to RAG if SQL path returned None

    # ═══════════════════════════════════════════════════════
    #  RAG PATH — PDF/DOCX/TXT (existing, unchanged)
    # ═══════════════════════════════════════════════════════
    similar_chunks = await retrieve_context(db, chatbot_id, user_message)
    context_chunks = [chunk["content"] for chunk in similar_chunks]

    chat_history = await get_chat_history(db, conversation.id)

    messages = build_rag_prompt(
        question=user_message,
        context_chunks=context_chunks,
        system_prompt=chatbot.system_prompt,
        chat_history=chat_history,
    )

    # Save user message
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.flush()

    # Stream LLM response
    full_response = ""
    yield f"__CONV_ID__{conversation.id}__END__"

    async for chunk in chat_completion_stream(messages):
        full_response += chunk
        yield chunk

    # Save assistant message
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=full_response,
    )
    db.add(assistant_msg)
    await db.flush()
