from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Chatbot Schemas ---
class ChatbotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    system_prompt: Optional[str] = None


class ChatbotUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    system_prompt: Optional[str] = None


class ChatbotResponse(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    status: str
    created_at: datetime
    document_count: Optional[int] = 0
    embedding_count: Optional[int] = 0

    class Config:
        from_attributes = True


# --- Document Schemas ---
class DocumentResponse(BaseModel):
    id: str
    chatbot_id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Chat Schemas ---
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    sources: list[dict] = []


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    chatbot_id: str
    source: str
    created_at: datetime
    messages: list[MessageResponse] = []

    class Config:
        from_attributes = True


# --- Widget Schemas ---
class WidgetChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    session_id: Optional[str] = None


# --- Integration Schemas ---
class IntegrationCreate(BaseModel):
    platform: str = Field(..., pattern="^(whatsapp|telegram)$")
    config_json: Optional[str] = "{}"


class IntegrationResponse(BaseModel):
    id: str
    chatbot_id: str
    platform: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Dashboard Schemas ---
class UsageStats(BaseModel):
    total_chatbots: int
    total_documents: int
    total_embeddings: int
    total_conversations: int
    total_messages: int
    messages_today: int


# --- Google Sheets Schemas ---
class GoogleSheetCreate(BaseModel):
    sheet_url: str
    sheet_name: Optional[str] = "Google Sheet"


class GoogleSheetResponse(BaseModel):
    id: str
    chatbot_id: str
    sheet_url: str
    sheet_name: str
    status: str
    last_synced_at: Optional[datetime] = None
    sync_interval_minutes: int
    created_at: datetime

    class Config:
        from_attributes = True
