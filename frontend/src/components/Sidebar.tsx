'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Chatbot } from '@/lib/types';
import {
    Bot, Plus, MessageSquare, Settings, Trash2, Edit2,
    ChevronLeft, ChevronRight, LogOut, LayoutDashboard,
    Check, X, MoreVertical, CreditCard
} from 'lucide-react';

interface SidebarProps {
    chatbots: Chatbot[];
    activeBotId: string;
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    onCreateBot: (name: string) => void;
    onDeleteBot: (botId: string) => void;
    onRenameBot: (botId: string, newName: string) => void;
    onLogout: () => void;
}

export default function Sidebar({
    chatbots,
    activeBotId,
    sidebarOpen,
    onToggleSidebar,
    onCreateBot,
    onDeleteBot,
    onRenameBot,
    onLogout,
}: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [showNewBot, setShowNewBot] = useState(false);
    const [newBotName, setNewBotName] = useState('');
    const [editingBot, setEditingBot] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    // Close sidebar on mobile when navigating
    // We can just rely on the parent logic or add a check here. 
    // Actually simpler to let the parent handle it or user click backdrop.
    // For now, let's just make sure links work.

    const handleCreate = () => {
        if (newBotName.trim()) {
            onCreateBot(newBotName.trim());
            setNewBotName('');
            setShowNewBot(false);
        }
    };

    const handleRename = (botId: string) => {
        if (editName.trim()) {
            onRenameBot(botId, editName.trim());
            setEditingBot(null);
            setEditName('');
        }
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onToggleSidebar}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 bg-dark-900 border-r border-dark-800 
                       flex flex-col transition-all duration-300 z-50
                       md:translate-x-0
                       ${sidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full md:w-16'}
                       `}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-800">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2.5 animate-fade-in">
                            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-base font-bold text-white">DocuBot AI</span>
                        </div>
                    )}
                    <button
                        onClick={onToggleSidebar}
                        className="p-2 rounded-lg text-dark-400 hover:bg-dark-800 hover:text-dark-200 transition-all"
                    >
                        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>

                {/* Dashboard Link */}
                <div className="px-3 pt-4 space-y-1">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className={`sidebar-item w-full ${!activeBotId && !pathname?.includes('/billing') ? 'active' : ''}`}
                    >
                        <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                        {sidebarOpen && <span className="text-sm">Dashboard</span>}
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/billing')}
                        className={`sidebar-item w-full ${pathname?.includes('/billing') ? 'active' : ''}`}
                    >
                        <CreditCard className="w-4 h-4 flex-shrink-0" />
                        {sidebarOpen && <span className="text-sm">Billing</span>}
                    </button>
                </div>

                {/* Chatbots Section */}
                <div className="flex-1 overflow-y-auto px-3 py-4">
                    {sidebarOpen && (
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
                                Your Bots
                            </span>
                            <button
                                onClick={() => setShowNewBot(true)}
                                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-800 hover:text-brand-400 transition-all"
                                title="Create new bot"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {!sidebarOpen && (
                        <button
                            onClick={() => {
                                onToggleSidebar();
                                setShowNewBot(true);
                            }}
                            className="w-full p-2 mb-3 rounded-lg text-dark-400 hover:bg-dark-800 hover:text-brand-400 transition-all flex justify-center"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}

                    {/* New Bot Input */}
                    {showNewBot && sidebarOpen && (
                        <div className="mb-3 p-2 rounded-xl bg-dark-800/50 border border-dark-700 animate-slide-up">
                            <input
                                type="text"
                                value={newBotName}
                                onChange={(e) => setNewBotName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-dark-100
                         placeholder:text-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="Bot name..."
                                autoFocus
                            />
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={handleCreate}
                                    className="flex-1 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-400 transition-all"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setShowNewBot(false); setNewBotName(''); }}
                                    className="p-1.5 text-dark-400 hover:text-dark-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bot List */}
                    <div className="space-y-1">
                        {chatbots.map((bot) => (
                            <div key={bot.id} className="relative group">
                                {editingBot === bot.id && sidebarOpen ? (
                                    <div className="flex items-center gap-1 px-2 py-2">
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRename(bot.id)}
                                            className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-dark-100
                               focus:outline-none focus:ring-1 focus:ring-brand-500"
                                            autoFocus
                                        />
                                        <button onClick={() => handleRename(bot.id)} className="p-1 text-emerald-400 hover:text-emerald-300">
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingBot(null)} className="p-1 text-dark-400 hover:text-dark-200">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => router.push(`/dashboard/bots/${bot.id}`)}
                                        className={`sidebar-item w-full cursor-pointer ${activeBotId === bot.id ? 'active' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                router.push(`/dashboard/bots/${bot.id}`);
                                            }
                                        }}
                                    >
                                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                                        {sidebarOpen && (
                                            <>
                                                <span className="text-sm truncate flex-1 text-left">{bot.name}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMenuOpen(menuOpen === bot.id ? null : bot.id);
                                                    }}
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-dark-500 hover:text-dark-300 transition-all focus:opacity-100"
                                                >
                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Context menu */}
                                {menuOpen === bot.id && sidebarOpen && (
                                    <div className="absolute right-2 top-full mt-1 bg-dark-800 border border-dark-700 rounded-xl shadow-xl py-1 z-50 min-w-[140px] animate-slide-up">
                                        <button
                                            onClick={() => {
                                                setEditingBot(bot.id);
                                                setEditName(bot.name);
                                                setMenuOpen(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-300 hover:bg-dark-700 hover:text-dark-100"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            Rename
                                        </button>
                                        <button
                                            onClick={() => {
                                                router.push(`/dashboard/bots/${bot.id}?tab=settings`);
                                                setMenuOpen(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-300 hover:bg-dark-700 hover:text-dark-100"
                                        >
                                            <Settings className="w-3.5 h-3.5" />
                                            Settings
                                        </button>
                                        <hr className="border-dark-700 my-1" />
                                        <button
                                            onClick={() => {
                                                if (confirm('Delete this chatbot? This cannot be undone.')) {
                                                    onDeleteBot(bot.id);
                                                }
                                                setMenuOpen(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {chatbots.length === 0 && sidebarOpen && (
                            <div className="px-4 py-8 text-center">
                                <MessageSquare className="w-8 h-8 text-dark-600 mx-auto mb-3" />
                                <p className="text-sm text-dark-500">No chatbots yet</p>
                                <p className="text-xs text-dark-600 mt-1">Click + to create one</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-dark-800">
                    <button
                        onClick={onLogout}
                        className="sidebar-item w-full text-dark-500 hover:text-red-400"
                    >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        {sidebarOpen && <span className="text-sm">Sign Out</span>}
                    </button>
                </div>
            </aside >
        </>
    );
}
