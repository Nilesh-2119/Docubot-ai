'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const code = searchParams.get('code');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Connecting to Google...');

    useEffect(() => {
        if (!code) {
            setStatus('error');
            setMessage('No authorization code found.');
            return;
        }

        const connect = async () => {
            try {
                await api.handleGoogleCallback(code);
                setStatus('success');
                setMessage('Successfully connected Google account! Redirecting...');
                setTimeout(() => {
                    const returnUrl = localStorage.getItem('google_auth_return_url') || '/dashboard';
                    localStorage.removeItem('google_auth_return_url');
                    router.push(returnUrl);
                }, 2000);
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Failed to connect Google account.');
            }
        };

        connect();
    }, [code, router]);

    return (
        <div className="p-8 bg-neutral-800 rounded-lg shadow-xl text-center max-w-md w-full">
            {status === 'loading' && (
                <>
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Connecting...</h2>
                    <p className="text-gray-400">{message}</p>
                </>
            )}
            {status === 'success' && (
                <>
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Connected!</h2>
                    <p className="text-gray-400">{message}</p>
                </>
            )}
            {status === 'error' && (
                <>
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
                    <p className="text-gray-400 mb-4">{message}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded transition"
                    >
                        Return to Dashboard
                    </button>
                </>
            )}
        </div>
    );
}

export default function GoogleCallbackPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white">
            <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin" />}>
                <CallbackContent />
            </Suspense>
        </div>
    );
}
