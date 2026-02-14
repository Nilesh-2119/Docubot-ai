'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Chatbot } from '@/lib/types';
import ChatArea from '@/components/ChatArea';
import ConversationSidebar from '@/components/ConversationSidebar';
import SettingsPanel from '@/components/SettingsPanel';
import { Settings, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ConversationItem {
    id: string;
    preview: string;
    message_count: number;
    source: string;
    created_at: string;
    updated_at: string;
}

export default function BotPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const botId = params?.id as string;

    const [chatbot, setChatbot] = useState<Chatbot | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);

    useEffect(() => {
        if (botId) {
            loadBot();
            loadConversations();
        }
    }, [botId]);

    useEffect(() => {
        if (searchParams?.get('tab') === 'settings') {
            setSettingsOpen(true);
        }
    }, [searchParams]);

    const loadBot = async () => {
        try {
            const bot = await api.getChatbot(botId);
            setChatbot(bot);
        } catch (error) {
            console.error('Failed to load bot:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadConversations = useCallback(async () => {
        setLoadingConversations(true);
        try {
            const convs = await api.getConversations(botId);
            setConversations(convs);
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            setLoadingConversations(false);
        }
    }, [botId]);

    const handleSelectConversation = async (convId: string) => {
        setConversationId(convId);
        setLoadingMessages(true);
        try {
            const msgs = await api.getConversationMessages(botId, convId);
            setMessages(
                msgs.map((m: any) => ({
                    id: m.id,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }))
            );
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleNewChat = () => {
        setConversationId(undefined);
        setMessages([]);
        setStreamingContent('');
    };

    const handleDeleteConversation = async (convId: string) => {
        try {
            await api.deleteConversation(botId, convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            // If deleting the active conversation, start a new chat
            if (convId === conversationId) {
                handleNewChat();
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
    };

    const handleSendMessage = async (message: string) => {
        // Add user message
        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsStreaming(true);
        setStreamingContent('');

        try {
            let fullContent = '';

            await api.sendMessageStream(
                botId,
                message,
                conversationId,
                // onChunk
                (chunk: string) => {
                    // Check for conversation ID in the stream
                    if (chunk.startsWith('__CONV_ID__')) {
                        const convId = chunk.replace('__CONV_ID__', '').replace('__END__', '');
                        setConversationId(convId);
                        return;
                    }
                    fullContent += chunk;
                    setStreamingContent(fullContent);
                },
                // onDone
                () => {
                    const assistantMsg: ChatMessage = {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: fullContent,
                    };
                    setMessages((prev) => [...prev, assistantMsg]);
                    setStreamingContent('');
                    setIsStreaming(false);
                    // Refresh conversation list to show the new/updated conversation
                    loadConversations();
                },
                // onError
                (error: string) => {
                    const errorMsg: ChatMessage = {
                        id: `error-${Date.now()}`,
                        role: 'assistant',
                        content: `Sorry, an error occurred: ${error}`,
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    setStreamingContent('');
                    setIsStreaming(false);
                }
            );
        } catch (error) {
            setIsStreaming(false);
            setStreamingContent('');
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    if (!chatbot) {
        return (
            <div className="h-screen flex items-center justify-center">
                <p className="text-dark-400">Chatbot not found</p>
            </div>
        );
    }

    return (
        <div className="h-screen flex relative">
            {/* Conversation Sidebar */}
            {sidebarOpen && (
                <ConversationSidebar
                    conversations={conversations}
                    activeConversationId={conversationId}
                    onSelectConversation={handleSelectConversation}
                    onNewChat={handleNewChat}
                    onDeleteConversation={handleDeleteConversation}
                    loading={loadingConversations}
                />
            )}

            {/* Main Chat */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${settingsOpen ? 'mr-[420px]' : ''}`}>
                {/* Top bar with sidebar toggle + settings toggle */}
                <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={`p-2.5 rounded-xl transition-all duration-200 ${sidebarOpen
                            ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            : 'bg-dark-800 text-dark-400 hover:text-dark-200 border border-dark-700'
                            }`}
                        title={sidebarOpen ? 'Hide chat history' : 'Show chat history'}
                    >
                        {sidebarOpen ? (
                            <PanelLeftClose className="w-4 h-4" />
                        ) : (
                            <PanelLeft className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className={`p-2.5 rounded-xl transition-all duration-200 ${settingsOpen
                            ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            : 'bg-dark-800 text-dark-400 hover:text-dark-200 border border-dark-700'
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>

                {/* Loading messages overlay */}
                {loadingMessages ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                            <p className="text-dark-400 text-sm">Loading conversation...</p>
                        </div>
                    </div>
                ) : (
                    <ChatArea
                        chatbotId={botId}
                        chatbotName={chatbot.name}
                        onSendMessage={handleSendMessage}
                        messages={messages}
                        isStreaming={isStreaming}
                        streamingContent={streamingContent}
                    />
                )}
            </div>

            {/* Settings Panel */}
            <SettingsPanel
                chatbot={chatbot}
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </div>
    );
}
