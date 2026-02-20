'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UsageStats } from '@/lib/types';
import {
    Bot, FileText, MessageSquare, Database,
    TrendingUp, Zap, ArrowUpRight, Crown, Shield
} from 'lucide-react';

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [userName, setUserName] = useState('');
    const [subscription, setSubscription] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsData, user, subData] = await Promise.all([
                api.getStats(),
                api.getMe(),
                api.getSubscription(),
            ]);
            setStats(statsData);
            setUserName(user.full_name);
            setSubscription(subData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    };

    const statCards = stats
        ? [
            {
                icon: Bot,
                label: 'Total Chatbots',
                value: stats.total_chatbots,
                color: 'from-brand-500 to-brand-600',
                iconBg: 'bg-brand-500/10',
                iconColor: 'text-brand-400',
            },
            {
                icon: FileText,
                label: 'Documents',
                value: stats.total_documents,
                color: 'from-emerald-500 to-emerald-600',
                iconBg: 'bg-emerald-500/10',
                iconColor: 'text-emerald-400',
            },
            {
                icon: Database,
                label: 'Embeddings',
                value: stats.total_embeddings,
                color: 'from-amber-500 to-amber-600',
                iconBg: 'bg-amber-500/10',
                iconColor: 'text-amber-400',
            },
            {
                icon: MessageSquare,
                label: 'Total Messages',
                value: stats.total_messages,
                color: 'from-purple-500 to-purple-600',
                iconBg: 'bg-purple-500/10',
                iconColor: 'text-purple-400',
            },
        ]
        : [];

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fade-in">
            {/* Welcome */}
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-white mb-2">
                    Welcome back{userName ? `, ${userName}` : ''} 👋
                </h1>
                <p className="text-dark-400">
                    Here&apos;s an overview of your DocuBot AI workspace.
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        className="glass-card group cursor-default animate-slide-up"
                        style={{ animationDelay: `${i * 80}ms` }}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-dark-600 group-hover:text-dark-400 transition-colors" />
                        </div>
                        <p className="text-2xl font-bold text-white mb-1">{card.value.toLocaleString()}</p>
                        <p className="text-sm text-dark-400">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Active Subscription */}
            {subscription && (
                <div className="mb-10 animate-slide-up" style={{ animationDelay: '320ms' }}>
                    <div className="glass-card relative overflow-hidden">
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${subscription.plan_name === 'ALFA' ? 'from-brand-500 to-brand-700' :
                                subscription.plan_name === 'BETA' ? 'from-blue-500 to-blue-700' :
                                    subscription.plan_name === 'CUSTOM' ? 'from-amber-500 to-amber-700' :
                                        'from-dark-600 to-dark-500'
                            }`} />
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${subscription.plan_name === 'ALFA' ? 'bg-brand-500/10' :
                                        subscription.plan_name === 'BETA' ? 'bg-blue-500/10' :
                                            subscription.plan_name === 'CUSTOM' ? 'bg-amber-500/10' :
                                                'bg-dark-700'
                                    }`}>
                                    {subscription.plan_name === 'FREE'
                                        ? <Shield className="w-6 h-6 text-dark-400" />
                                        : <Crown className={`w-6 h-6 ${subscription.plan_name === 'ALFA' ? 'text-brand-400' :
                                                subscription.plan_name === 'BETA' ? 'text-blue-400' :
                                                    'text-amber-400'
                                            }`} />
                                    }
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-white">{subscription.plan_name} Plan</h3>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${subscription.plan_name === 'ALFA' ? 'bg-brand-500/15 text-brand-400' :
                                                subscription.plan_name === 'BETA' ? 'bg-blue-500/15 text-blue-400' :
                                                    subscription.plan_name === 'CUSTOM' ? 'bg-amber-500/15 text-amber-400' :
                                                        'bg-dark-700 text-dark-400'
                                            }`}>ACTIVE</span>
                                    </div>
                                    <p className="text-sm text-dark-400 mt-0.5">
                                        {subscription.chatbots_used} / {subscription.chatbots_max ?? '∞'} chatbots used
                                        {subscription.plan_price > 0 && ` · $${subscription.plan_price}/mo`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {subscription.chatbots_max && (
                                    <div className="w-32">
                                        <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${(subscription.chatbots_used / subscription.chatbots_max) > 0.8
                                                        ? 'bg-gradient-to-r from-red-500 to-red-400'
                                                        : 'bg-gradient-to-r from-brand-500 to-brand-400'
                                                    }`}
                                                style={{ width: `${Math.min((subscription.chatbots_used / subscription.chatbots_max) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => router.push('/dashboard/billing')}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all
                                        bg-dark-700/50 text-dark-300 hover:bg-dark-700 hover:text-white
                                        flex items-center gap-1.5"
                                >
                                    {subscription.plan_name === 'FREE' ? 'Upgrade' : 'Manage'}
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
                            <Zap className="w-5 h-5 text-brand-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Quick Start</h3>
                            <p className="text-sm text-dark-400">Get started in minutes</p>
                        </div>
                    </div>
                    <div className="space-y-3 text-sm text-dark-300">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
                            <span className="w-6 h-6 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            <span>Create a new chatbot from the sidebar</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
                            <span className="w-6 h-6 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            <span>Upload your documents (PDF, DOCX, etc.)</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
                            <span className="w-6 h-6 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            <span>Start chatting with your AI-powered bot</span>
                        </div>
                    </div>
                </div>

                <div className="glass-card">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Today&apos;s Activity</h3>
                            <p className="text-sm text-dark-400">Messages processed today</p>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-6">
                        <span className="text-4xl font-bold text-white">
                            {stats?.messages_today || 0}
                        </span>
                        <span className="text-dark-400 text-sm">messages</span>
                    </div>
                    <div className="mt-4 h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (stats?.messages_today || 0) * 2)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
