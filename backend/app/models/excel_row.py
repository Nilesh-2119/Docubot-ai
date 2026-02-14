import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base


class ExcelRow(Base):
    """
    Stores structured Excel/CSV data as JSONB rows.
    Used by the SQL query path for aggregation and row lookup queries.
    Replaces embedding-based retrieval for tabular data.
    """
    __tablename__ = "excel_rows"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chatbot_id: Mapped[str] = mapped_column(
        String, ForeignKey("chatbots.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[str] = mapped_column(
        String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    sheet_name: Mapped[str] = mapped_column(String(200), nullable=False, default="Sheet1")
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    row_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Indexes for fast queries
    __table_args__ = (
        Index("idx_excel_rows_chatbot", "chatbot_id"),
        Index("idx_excel_rows_document", "document_id"),
        Index("idx_excel_rows_chatbot_doc", "chatbot_id", "document_id"),
    )

    # Relationships
    chatbot = relationship("Chatbot")
    document = relationship("Document")
