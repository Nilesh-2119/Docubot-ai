export interface User {
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    created_at: string;
}

export interface Chatbot {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    status: string;
    created_at: string;
    document_count?: number;
    embedding_count?: number;
}

export interface Document {
    id: string;
    chatbot_id: string;
    filename: string;
    file_type: string;
    file_size: number;
    chunk_count: number;
    status: string;
    created_at: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export interface ChatResponse {
    response: string;
    conversation_id: string;
    sources: Array<{ content: string; similarity: number }>;
}

export interface UsageStats {
    total_chatbots: number;
    total_documents: number;
    total_embeddings: number;
    total_conversations: number;
    total_messages: number;
    messages_today: number;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}
