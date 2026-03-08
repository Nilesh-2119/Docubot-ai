'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Loader2, Mail, Lock, User, ArrowRight, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
    const router = useRouter();
    const { user: currentUser, loading: authLoading } = useAuth();
    
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (currentUser && !authLoading) {
            router.push('/dashboard');
        }
    }, [currentUser, authLoading, router]);

    const handleGoogleRegister = async () => {
        setGoogleLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast.success('Account created successfully!');
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(error.message || 'Failed to register with Google');
            setGoogleLoading(false);
        }
    };

    const handleEmailRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: fullName });
            
            // Send verification email
            import('firebase/auth').then(({ sendEmailVerification }) => {
                sendEmailVerification(userCredential.user);
            });
            
            toast.success('Account created! Please check your email to verify.');
            router.push('/verify-email');
        } catch (error: any) {
            toast.error(error.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };
    
    if (authLoading) {
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
                    <p className="text-dark-400">Create your account</p>
                </div>

                {/* Form Card */}
                <div className="glass-card p-8 space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-1">Get Started</h2>
                        <p className="text-dark-400 text-sm">
                            Join DocuBot AI to build intelligent document chatbots.
                        </p>
                    </div>
                    
                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleRegister}
                        disabled={googleLoading || loading}
                        className="w-full py-3 px-4 rounded-xl bg-white text-dark-900 font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {googleLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Globe className="w-5 h-5 text-blue-500" />
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-dark-700" />
                        <span className="text-xs text-dark-500 font-medium">OR</span>
                        <div className="flex-1 h-px bg-dark-700" />
                    </div>

                    <form onSubmit={handleEmailRegister} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-dark-400 mb-1.5">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-dark-800/50 border border-dark-700 rounded-xl text-white placeholder-dark-500 text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-dark-400 mb-1.5">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-dark-800/50 border border-dark-700 rounded-xl text-white placeholder-dark-500 text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-dark-400 mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    required
                                    minLength={8}
                                    className="w-full pl-10 pr-4 py-3 bg-dark-800/50 border border-dark-700 rounded-xl text-white placeholder-dark-500 text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || googleLoading}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium hover:from-brand-600 hover:to-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                    
                    <p className="text-center text-sm text-dark-400">
                        Already have an account?{' '}
                        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                            Sign In
                        </Link>
                    </p>
                </div>

                <p className="text-[10px] text-dark-500 mt-4 text-center leading-relaxed px-4">
                    By creating an account, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
