'use client';

import { useState } from 'react';
import { MessageSquare, Plus, Trash2, Clock, Loader2 } from 'lucide-react';

interface Conversation {
    id: string;
    preview: string;
    message_count: number;
    source: string;
    created_at: string;
    updated_at: string;
}

interface ConversationSidebarProps {
    conversations: Conversation[];
    activeConversationId: string | undefined;
    onSelectConversation: (id: string) => void;
    onNewChat: () => void;
    onDeleteConversation: (id: string) => void;
    loading: boolean;
}

function timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

export default function ConversationSidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewChat,
    onDeleteConversation,
    loading,
}: ConversationSidebarProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        await onDeleteConversation(id);
        setDeletingId(null);
    };

    return (
        <aside className="fixed inset-y-0 left-0 z-40 w-72 h-full bg-dark-950 border-r border-dark-800 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none">
            {/* Header + New Chat Button */}
            <div className="p-4 border-b border-dark-800">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                   bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium
                                   transition-all duration-200 shadow-lg shadow-brand-500/20"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto py-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-dark-500 animate-spin" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-12 h-12 bg-dark-800 rounded-xl flex items-center justify-center mb-3">
                            <MessageSquare className="w-6 h-6 text-dark-500" />
                        </div>
                        <p className="text-dark-400 text-sm">No conversations yet</p>
                        <p className="text-dark-600 text-xs mt-1">Start a new chat to begin</p>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv.id)}
                            className={`group mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer
                                            transition-all duration-150 relative
                                            ${activeConversationId === conv.id
                                    ? 'bg-brand-500/10 border border-brand-500/20'
                                    : 'hover:bg-dark-800/60 border border-transparent'
                                }`}
                        >
                            <div className="flex items-start gap-2.5">
                                <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeConversationId === conv.id
                                    ? 'text-brand-400'
                                    : 'text-dark-500'
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate leading-tight ${activeConversationId === conv.id
                                        ? 'text-white font-medium'
                                        : 'text-dark-300'
                                        }`}>
                                        {conv.preview}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock className="w-3 h-3 text-dark-600" />
                                        <span className="text-xs text-dark-600">
                                            {timeAgo(conv.updated_at)}
                                        </span>
                                        <span className="text-xs text-dark-700">·</span>
                                        <span className="text-xs text-dark-600">
                                            {conv.message_count} msgs
                                        </span>
                                    </div>
                                </div>

                                {/* Delete button */}
                                <button
                                    onClick={(e) => handleDelete(e, conv.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md
                                                   hover:bg-red-500/10 text-dark-500 hover:text-red-400
                                                   transition-all duration-150"
                                    title="Delete conversation"
                                >
                                    {deletingId === conv.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
