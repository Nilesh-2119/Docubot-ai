'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const code = searchParams.get('code');
    const processed = useRef(false);

    useEffect(() => {
        if (!code) {
            // If no code, maybe redirect to login?
            // But wait, what if it's an error?
            const error = searchParams.get('error');
            if (error) {
                toast.error(`Auth Error: ${error}`);
                router.push('/login');
            }
            return;
        }

        if (processed.current) return;
        processed.current = true;

        const login = async () => {
            try {
                const data = await api.googleLogin(code);
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                toast.success('Successfully logged in!');
                router.push('/dashboard');
            } catch (err: any) {
                console.error(err);
                toast.error(err.message || 'Login failed');
                router.push('/login');
            }
        };

        login();
    }, [code, router, searchParams]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-dark-950">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
            <h2 className="text-dark-200 animate-pulse">Authenticating...</h2>
        </div>
    );
}
