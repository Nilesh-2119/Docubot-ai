"""Plan model — defines available subscription tiers."""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )  # FREE, BETA, ALFA, CUSTOM
    price_monthly: Mapped[float] = mapped_column(Float, default=0.0)
    max_chatbots: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # NULL = unlimited
    allow_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_google_sync: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
