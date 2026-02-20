'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Bot, Loader2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { url } = await api.getGoogleLoginUrl();
            window.location.href = url;
        } catch (error: any) {
            toast.error('Failed to initialize Google Login');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-dark-900">
            {/* Background effects */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 -left-40 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl" />

            <div className="w-full max-w-md animate-fade-in text-center">
                {/* Logo */}
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                            <Bot className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white">DocuBot AI</span>
                    </Link>
                    <p className="text-dark-400">Sign in to your account</p>
                </div>

                {/* Login Box */}
                <div className="glass-card p-8 space-y-6">
                    <h2 className="text-xl font-semibold text-white">Welcome Back</h2>
                    <p className="text-dark-400 text-sm">
                        Please sign in to access your dashboard.
                    </p>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-xl bg-white text-dark-900 font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Globe className="w-5 h-5 text-blue-500" />
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    <p className="text-[10px] text-dark-500 mt-4 leading-relaxed">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                        If you don&apos;t have an account, one will be created automatically.
                    </p>
                </div>
            </div>
        </div>
    );
}
