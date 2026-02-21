from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/docubot"

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OpenRouter (LLM)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MODEL: str = "openai/gpt-4o-mini"

    # OpenAI Embeddings (or use OpenRouter)
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # RAG Tuning
    RAG_SIMILARITY_THRESHOLD: float = 0.20
    RAG_TOP_K: int = 5
    RAG_MAX_CONTEXT_TOKENS: int = 40000
    RAG_DEBUG: bool = False
    LLM_TEMPERATURE: float = 0.0

    # WhatsApp
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "docubot-verify"

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # App
    APP_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10

    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/google-callback"

    # Stripe Billing
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_BETA: str = ""  # Stripe price ID for Beta plan
    STRIPE_PRICE_ALFA: str = ""  # Stripe price ID for Alfa plan

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    
    # Render/Heroku provide postgres:// URLs, but SQLAlchemy 2.0 requires postgresql://
    # and we need to explicitly specify the asyncpg driver.
    if settings.DATABASE_URL.startswith("postgres://"):
        settings.DATABASE_URL = settings.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif settings.DATABASE_URL.startswith("postgresql://"):
        settings.DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    return settings
