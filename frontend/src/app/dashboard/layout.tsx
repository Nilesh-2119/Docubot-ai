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
    }, [router]);

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
        <div className="min-h-screen flex bg-dark-950">
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
            <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-16'}`}>
                {children}
            </main>
        </div>
    );
}
