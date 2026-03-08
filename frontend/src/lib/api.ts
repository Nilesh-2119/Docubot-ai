import { auth } from '@/lib/firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_URL;
    }

    private async getToken(): Promise<string | null> {
        if (!auth.currentUser) return null;
        try {
            return await auth.currentUser.getIdToken();
        } catch {
            return null;
        }
    }

    private async getHeaders(isFormData = false): Promise<HeadersInit> {
        const headers: HeadersInit = {};
        const token = await this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const isFormData = options.body instanceof FormData;
        const headers = await this.getHeaders(isFormData);
        
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                ...headers,
                ...(options.headers || {}),
            },
        });

        if (response.status === 401) {
            // Let the AuthContext handle redirection organically
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(errorData.detail || 'Request failed');
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // Auth

    async getMe() {
        return this.request<{ id: string; email: string; full_name: string }>('/api/auth/me');
    }

    // Chatbots
    async getChatbots() {
        return this.request<any[]>('/api/chatbots/');
    }

    async createChatbot(name: string, description?: string) {
        return this.request<any>('/api/chatbots/', {
            method: 'POST',
            body: JSON.stringify({ name, description }),
        });
    }

    async getChatbot(id: string) {
        return this.request<any>(`/api/chatbots/${id}`);
    }

    async updateChatbot(id: string, data: { name?: string; description?: string; system_prompt?: string }) {
        return this.request<any>(`/api/chatbots/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteChatbot(id: string) {
        return this.request<any>(`/api/chatbots/${id}`, { method: 'DELETE' });
    }

    // Documents
    async getDocuments(chatbotId: string) {
        return this.request<any[]>(`/api/chatbots/${chatbotId}/documents/`);
    }

    async uploadDocument(chatbotId: string, file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request<any>(`/api/chatbots/${chatbotId}/documents/upload`, {
            method: 'POST',
            body: formData,
        });
    }

    async deleteDocument(chatbotId: string, documentId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/documents/${documentId}`, {
            method: 'DELETE',
        });
    }

    async getEmbeddingCount(chatbotId: string) {
        return this.request<{ count: number }>(`/api/chatbots/${chatbotId}/documents/embeddings/count`);
    }

    // Chat
    async sendMessage(chatbotId: string, message: string, conversationId?: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/chat/`, {
            method: 'POST',
            body: JSON.stringify({ message, conversation_id: conversationId }),
        });
    }

    // Streaming Chat
    async sendMessageStream(
        chatbotId: string,
        message: string,
        conversationId: string | undefined,
        onChunk: (chunk: string) => void,
        onDone: () => void,
        onError: (error: string) => void,
    ) {
        const token = this.getToken();
        const response = await fetch(`${this.baseUrl}/api/chatbots/${chatbotId}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message, conversation_id: conversationId }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: 'Stream failed' }));
            onError(err.detail || 'Stream failed');
            return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            onError('No response body');
            return;
        }

        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                        onDone();
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            onChunk(parsed.content);
                        }
                        if (parsed.error) {
                            onError(parsed.error);
                            return;
                        }
                    } catch { }
                }
            }
        }
        onDone();
    }

    // Conversation History
    async getConversations(chatbotId: string) {
        return this.request<any[]>(`/api/chatbots/${chatbotId}/chat/conversations`);
    }

    async getConversationMessages(chatbotId: string, conversationId: string) {
        return this.request<any[]>(`/api/chatbots/${chatbotId}/chat/conversations/${conversationId}/messages`);
    }

    async deleteConversation(chatbotId: string, conversationId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/chat/conversations/${conversationId}`, {
            method: 'DELETE',
        });
    }

    // Dashboard
    async getStats() {
        return this.request<any>('/api/dashboard/stats');
    }

    // Google Sheets
    async addGoogleSheet(chatbotId: string, sheetUrl: string, sheetName?: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/gsheets/`, {
            method: 'POST',
            body: JSON.stringify({ sheet_url: sheetUrl, sheet_name: sheetName || 'Google Sheet' }),
        });
    }

    async getGoogleSheets(chatbotId: string) {
        return this.request<any[]>(`/api/chatbots/${chatbotId}/gsheets/`);
    }

    async syncGoogleSheet(chatbotId: string, sheetId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/gsheets/${sheetId}/sync`, {
            method: 'POST',
        });
    }

    async deleteGoogleSheet(chatbotId: string, sheetId: string) {
        return this.request<void>(`/api/chatbots/${chatbotId}/gsheets/${sheetId}`, {
            method: 'DELETE',
        });
    }


    // Google Sheets
    async getGoogleAuthUrl() {
        return this.request<{ url: string }>('/api/auth/google/url');
    }

    async handleGoogleCallback(code: string) {
        return this.request<{ status: string; email?: string }>('/api/auth/google/callback', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    }

    async getGoogleAuthStatus() {
        return this.request<{ connected: boolean; email?: string | null }>('/api/auth/google/status');
    }

    async addStructuredSheet(chatbotId: string, sheetUrl: string, sheetName?: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/gsheets/oauth`, { // Changed to /oauth endpoint
            method: 'POST',
            body: JSON.stringify({ sheet_url: sheetUrl, sheet_name: sheetName || 'Google Sheet' }),
        });
    }

    async syncStructuredSheet(chatbotId: string, sheetId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/gsheets/${sheetId}/sync-structured`, {
            method: 'POST',
        });
    }

    // Integrations (WhatsApp / Telegram)
    async getIntegrations(chatbotId: string) {
        return this.request<any[]>(`/api/chatbots/${chatbotId}/integrations/`);
    }

    async createIntegration(chatbotId: string, platform: string, config: Record<string, string>) {
        return this.request<any>(`/api/chatbots/${chatbotId}/integrations/`, {
            method: 'POST',
            body: JSON.stringify({ platform, config }),
        });
    }

    async updateIntegration(chatbotId: string, integrationId: string, data: { config?: Record<string, string>; is_active?: boolean }) {
        return this.request<any>(`/api/chatbots/${chatbotId}/integrations/${integrationId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteIntegration(chatbotId: string, integrationId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/integrations/${integrationId}`, {
            method: 'DELETE',
        });
    }

    // WhatsApp (shared number)
    async getWhatsAppStatus(chatbotId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/whatsapp/status`);
    }

    async enableWhatsApp(chatbotId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/whatsapp/enable`, {
            method: 'POST',
        });
    }

    async disableWhatsApp(chatbotId: string) {
        return this.request<any>(`/api/chatbots/${chatbotId}/whatsapp/disable`, {
            method: 'DELETE',
        });
    }

    // Billing
    async getPlans() {
        return this.request<any[]>('/api/billing/plans');
    }

    async getSubscription() {
        return this.request<any>('/api/billing/subscription');
    }

    async upgradePlan(planName: string) {
        return this.request<{ status: string; plan: string }>('/api/billing/upgrade-plan', {
            method: 'POST',
            body: JSON.stringify({ plan_name: planName }),
        });
    }
}

export const api = new ApiClient();
