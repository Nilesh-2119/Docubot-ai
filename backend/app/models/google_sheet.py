import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class GoogleSheet(Base):
    __tablename__ = "google_sheets"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chatbot_id: Mapped[str] = mapped_column(
        String, ForeignKey("chatbots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sheet_url: Mapped[str] = mapped_column(Text, nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(255), default="Google Sheet")
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=True
    )
    last_data_hash: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(20), default="syncing")
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    chatbot = relationship("Chatbot", back_populates="google_sheets")
