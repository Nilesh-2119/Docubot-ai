'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChatAreaProps {
    chatbotId: string;
    chatbotName: string;
    onSendMessage: (message: string) => void;
    messages: Message[];
    isStreaming: boolean;
    streamingContent: string;
}

export default function ChatArea({
    chatbotId,
    chatbotName,
    onSendMessage,
    messages,
    isStreaming,
    streamingContent,
}: ChatAreaProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isStreaming) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-800 bg-dark-900/50 backdrop-blur-sm">
                <div className="w-9 h-9 bg-brand-500/10 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-white">{chatbotName}</h2>
                    <p className="text-xs text-dark-500">
                        {isStreaming ? (
                            <span className="text-brand-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Thinking...
                            </span>
                        ) : (
                            'Online'
                        )}
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {messages.length === 0 && !isStreaming && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-brand-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Start a Conversation</h3>
                        <p className="text-dark-400 text-sm max-w-md">
                            Ask me anything about the documents that have been uploaded. I&apos;ll find the most relevant information and give you a helpful answer.
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 bg-brand-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot className="w-4 h-4 text-brand-400" />
                            </div>
                        )}
                        <div
                            className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-brand-600 text-white rounded-br-md'
                                    : 'bg-dark-800 text-dark-200 rounded-bl-md border border-dark-700'
                                }`}
                        >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                <User className="w-4 h-4 text-dark-300" />
                            </div>
                        )}
                    </div>
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                    <div className="flex gap-3 justify-start animate-slide-up">
                        <div className="w-8 h-8 bg-brand-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-4 h-4 text-brand-400" />
                        </div>
                        <div className="max-w-[70%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed bg-dark-800 text-dark-200 border border-dark-700">
                            <div className="whitespace-pre-wrap">{streamingContent}</div>
                            <span className="inline-block w-2 h-4 bg-brand-400 animate-pulse-soft ml-0.5" />
                        </div>
                    </div>
                )}

                {/* Typing indicator */}
                {isStreaming && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 bg-brand-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-brand-400" />
                        </div>
                        <div className="bg-dark-800 border border-dark-700 rounded-2xl rounded-bl-md px-5 py-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 bg-dark-400 rounded-full typing-dot" />
                                <div className="w-2 h-2 bg-dark-400 rounded-full typing-dot" />
                                <div className="w-2 h-2 bg-dark-400 rounded-full typing-dot" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-dark-800 bg-dark-900/50 backdrop-blur-sm">
                <form onSubmit={handleSubmit} className="flex items-end gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            rows={1}
                            className="input-field resize-none pr-4 max-h-32"
                            style={{
                                height: 'auto',
                                minHeight: '48px',
                            }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                            }}
                            disabled={isStreaming}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || isStreaming}
                        className="btn-primary p-3 rounded-xl disabled:opacity-30"
                    >
                        {isStreaming ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
