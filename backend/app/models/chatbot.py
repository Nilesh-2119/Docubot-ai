import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class ChatbotStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRAINING = "training"


class Chatbot(Base):
    __tablename__ = "chatbots"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), default="")
    system_prompt: Mapped[str] = mapped_column(
        String(2000),
        default="You are a helpful AI assistant. Answer questions based only on the provided context. If you don't know the answer, say so."
    )
    status: Mapped[str] = mapped_column(
        SQLEnum(ChatbotStatus), default=ChatbotStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="chatbots")
    documents = relationship("Document", back_populates="chatbot", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="chatbot", cascade="all, delete-orphan")
    integrations = relationship("Integration", back_populates="chatbot", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="chatbot", cascade="all, delete-orphan")
    google_sheets = relationship("GoogleSheet", back_populates="chatbot", cascade="all, delete-orphan")
