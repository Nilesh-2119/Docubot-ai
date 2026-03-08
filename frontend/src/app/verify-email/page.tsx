'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, Loader2, Bot, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sendEmailVerification } from 'firebase/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function VerifyEmailPage() {
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        } else if (user?.emailVerified) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleResendEmail = async () => {
        if (!user || countdown > 0) return;
        
        setResendLoading(true);
        try {
            await sendEmailVerification(user);
            toast.success('Verification email sent!');
            setCountdown(60); // 60 second cooldown
        } catch (error: any) {
            if (error.code === 'auth/too-many-requests') {
                toast.error('Too many requests. Please try again later.');
            } else {
                toast.error(error.message || 'Failed to resend email');
            }
        } finally {
            setResendLoading(false);
        }
    };

    const handleCheckVerificationStatus = () => {
        if (user) {
            user.reload().then(() => {
                if (user.emailVerified) {
                    toast.success('Email verified successfully!');
                    router.push('/dashboard');
                } else {
                    toast.error('Email not verified yet. Please check your inbox.');
                }
            });
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-950">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-dark-900">
            {/* Background effects */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 -left-40 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl" />
            <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />

            <div className="w-full max-w-md animate-fade-in z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                            <Bot className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white">DocuBot AI</span>
                    </Link>
                </div>

                {/* Form Card */}
                <div className="glass-card p-8 space-y-6 text-center">
                    <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-8 h-8 text-brand-400" />
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Verify your email</h2>
                        <p className="text-dark-400 text-sm leading-relaxed">
                            We've sent a verification link to <br/>
                            <span className="text-white font-medium">{user.email}</span>
                        </p>
                    </div>

                    <div className="pt-4 space-y-3">
                        <button
                            onClick={handleCheckVerificationStatus}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium hover:from-brand-600 hover:to-brand-700 transition-all flex items-center justify-center gap-2"
                        >
                            I've verified my email
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        
                        <button
                            onClick={handleResendEmail}
                            disabled={resendLoading || countdown > 0}
                            className="w-full py-3 px-4 rounded-xl bg-dark-800 text-white font-medium hover:bg-dark-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {resendLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : countdown > 0 ? (
                                `Resend email in ${countdown}s`
                            ) : (
                                'Resend verification email'
                            )}
                        </button>
                    </div>

                    <div className="pt-4 border-t border-dark-800">
                        <button
                            onClick={logout}
                            className="text-dark-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign out
                        </button>
                    </div>
                </div>

                <p className="text-[11px] text-dark-500 mt-6 text-center leading-relaxed px-4">
                    Didn't receive the email? Check your spam folder or try resending the link.
                </p>
            </div>
        </div>
    );
}
