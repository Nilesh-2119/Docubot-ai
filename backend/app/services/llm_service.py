"""
Modular LLM service.
Default: OpenRouter (OpenAI-compatible API)
Can be swapped by changing provider config.
"""
from typing import AsyncGenerator
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

# OpenRouter uses OpenAI-compatible API
llm_client = AsyncOpenAI(
    api_key=settings.OPENROUTER_API_KEY,
    base_url=settings.OPENROUTER_BASE_URL,
)


async def chat_completion(
    messages: list[dict],
    model: str = None,
    temperature: float = None,
    max_tokens: int = 2048,
) -> str:
    """Non-streaming chat completion."""
    response = await llm_client.chat.completions.create(
        model=model or settings.LLM_MODEL,
        messages=messages,
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def chat_completion_stream(
    messages: list[dict],
    model: str = None,
    temperature: float = None,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """Streaming chat completion - yields text chunks."""
    stream = await llm_client.chat.completions.create(
        model=model or settings.LLM_MODEL,
        messages=messages,
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


def build_rag_prompt(
    question: str,
    context_chunks: list[str],
    system_prompt: str,
    chat_history: list[dict] = None,
) -> list[dict]:
    """
    Build the prompt for RAG chat.
    Used ONLY for PDF/DOCX/TXT documents.
    Excel/CSV queries bypass this entirely via the SQL path.
    """
    context = "\n\n---\n\n".join(context_chunks)

    system_message = f"""{system_prompt}

Use the following context to answer the user's question accurately.

IMPORTANT RULES:
- Read each section in the context carefully.
- Answer based ONLY on information found in the context.
- If the context doesn't contain relevant information, say you don't have enough information.
- Do NOT guess or make up information not present in the context.
- Be precise and quote relevant details from the context when helpful.

CONTEXT:
{context}"""

    messages = [{"role": "system", "content": system_message}]

    # Add chat history (last 10 messages)
    if chat_history:
        for msg in chat_history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})
    return messages
