'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, FileText, MessageSquare, Globe, Zap, Shield } from 'lucide-react';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            router.push('/dashboard');
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-dark-950 relative overflow-hidden">
            {/* Background gradient effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white">DocuBot AI</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/login')}
                        className="btn-ghost"
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => router.push('/register')}
                        className="btn-primary"
                    >
                        Get Started
                    </button>
                </div>
            </header>

            {/* Hero */}
            <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
                <div className="text-center max-w-3xl mx-auto animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8">
                        <Zap className="w-4 h-4" />
                        Powered by RAG Technology
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6">
                        Turn Documents Into{' '}
                        <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
                            AI Chatbots
                        </span>
                    </h1>
                    <p className="text-lg text-dark-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Upload your PDF, DOCX, XLSX, CSV or TXT files and create an intelligent chatbot
                        that answers questions from your documents. Embed anywhere, connect to WhatsApp
                        and Telegram.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => router.push('/register')}
                            className="btn-primary text-lg px-8 py-3.5"
                        >
                            Start Building Free
                        </button>
                        <button
                            onClick={() => router.push('/login')}
                            className="btn-secondary text-lg px-8 py-3.5"
                        >
                            View Demo
                        </button>
                    </div>
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32">
                    {[
                        {
                            icon: FileText,
                            title: 'Smart Document Processing',
                            desc: 'Upload PDF, DOCX, XLSX, CSV, or TXT. Our pipeline extracts, chunks, and embeds your content automatically.',
                        },
                        {
                            icon: MessageSquare,
                            title: 'RAG-Powered Chat',
                            desc: 'Ask questions and get accurate answers from your documents with source citations and conversation memory.',
                        },
                        {
                            icon: Globe,
                            title: 'Deploy Anywhere',
                            desc: 'Embed a chat widget on your website, connect to WhatsApp and Telegram with one-click integrations.',
                        },
                    ].map((feature, i) => (
                        <div
                            key={i}
                            className="glass-card group animate-slide-up"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-all">
                                <feature.icon className="w-6 h-6 text-brand-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                            <p className="text-dark-400 text-sm leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-8 mt-20 text-dark-500 text-sm">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>Enterprise-grade Security</span>
                    </div>
                    <div className="w-1 h-1 bg-dark-600 rounded-full" />
                    <span>Multi-tenant Architecture</span>
                    <div className="w-1 h-1 bg-dark-600 rounded-full" />
                    <span>99.9% Uptime</span>
                </div>
            </main>
        </div>
    );
}
