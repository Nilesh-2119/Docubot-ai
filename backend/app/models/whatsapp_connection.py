"""WhatsApp connection model for shared-number architecture."""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WhatsAppConnection(Base):
    __tablename__ = "whatsapp_connections"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chatbot_id: Mapped[str] = mapped_column(
        String, ForeignKey("chatbots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    whatsapp_phone: Mapped[str | None] = mapped_column(
        String(30), nullable=True, unique=True, index=True
    )
    access_code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    chatbot = relationship("Chatbot")
    user = relationship("User")
