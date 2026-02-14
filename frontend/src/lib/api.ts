const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_URL;
    }

    private getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('access_token');
    }

    private getHeaders(isFormData = false): HeadersInit {
        const headers: HeadersInit = {};
        const token = this.getToken();
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
        const isAuthEndpoint = endpoint.startsWith('/api/auth/login') || endpoint.startsWith('/api/auth/register');
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                ...this.getHeaders(isFormData),
                ...(options.headers || {}),
            },
        });

        if (response.status === 401 && !isAuthEndpoint) {
            // Try to refresh token (only for non-auth endpoints)
            const refreshed = await this.refreshToken();
            if (refreshed) {
                const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...options,
                    headers: {
                        ...this.getHeaders(isFormData),
                        ...(options.headers || {}),
                    },
                });
                if (!retryResponse.ok) {
                    throw new Error(await retryResponse.text());
                }
                return retryResponse.json();
            }
            // Redirect to login
            if (typeof window !== 'undefined') {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
            }
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

    private async refreshToken(): Promise<boolean> {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) return false;

        try {
            const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (!response.ok) return false;

            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            return true;
        } catch {
            return false;
        }
    }

    // Auth
    async register(email: string, password: string, fullName: string) {
        return this.request<{ access_token: string; refresh_token: string }>(
            '/api/auth/register',
            {
                method: 'POST',
                body: JSON.stringify({ email, password, full_name: fullName }),
            }
        );
    }

    async login(email: string, password: string) {
        return this.request<{ access_token: string; refresh_token: string }>(
            '/api/auth/login',
            {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            }
        );
    }

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
}

export const api = new ApiClient();
