'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Chatbot } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [chatbots, setChatbots] = useState<Chatbot[]>([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const activeBotId = pathname?.split('/bots/')?.[1]?.split('/')?.[0] || '';

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            router.push('/login');
            return;
        }
        loadChatbots();
        // Close sidebar on mobile navigation
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, [router, pathname]);

    const loadChatbots = async () => {
        try {
            const bots = await api.getChatbots();
            setChatbots(bots);
        } catch (error) {
            console.error('Failed to load chatbots:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBot = async (name: string) => {
        try {
            const newBot = await api.createChatbot(name);
            setChatbots((prev) => [newBot, ...prev]);
            router.push(`/dashboard/bots/${newBot.id}`);
        } catch (error) {
            console.error('Failed to create bot:', error);
        }
    };

    const handleDeleteBot = async (botId: string) => {
        try {
            await api.deleteChatbot(botId);
            setChatbots((prev) => prev.filter((b) => b.id !== botId));
            if (activeBotId === botId) {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to delete bot:', error);
        }
    };

    const handleRenameBot = async (botId: string, newName: string) => {
        try {
            await api.updateChatbot(botId, { name: newName });
            setChatbots((prev) =>
                prev.map((b) => (b.id === botId ? { ...b, name: newName } : b))
            );
        } catch (error) {
            console.error('Failed to rename bot:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-950">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-dark-950 font-sans">
            <Sidebar
                chatbots={chatbots}
                activeBotId={activeBotId}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                onCreateBot={handleCreateBot}
                onDeleteBot={handleDeleteBot}
                onRenameBot={handleRenameBot}
                onLogout={handleLogout}
            />

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-dark-900 border-b border-dark-800 z-30 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-dark-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="font-semibold text-white">DocuBot AI</span>
                </div>
            </div>

            <main className={`flex-1 transition-all duration-300 pt-14 md:pt-0 ${sidebarOpen ? 'md:ml-72' : 'md:ml-16'}`}>
                {children}
            </main>
        </div>
    );
}
