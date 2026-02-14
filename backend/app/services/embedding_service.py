"""
Embedding service using OpenAI text-embedding-3-small.
Requires OPENAI_API_KEY in .env
"""
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

embedding_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

EMBEDDING_DIM = 1536


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI."""
    response = await embedding_client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


async def get_single_embedding(text: str) -> list[float]:
    """Generate embedding for a single text."""
    embeddings = await get_embeddings([text])
    return embeddings[0]
