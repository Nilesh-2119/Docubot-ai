'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Protect routes
    useEffect(() => {
        if (!loading) {
            // Check if the user is using email/password and hasn't verified
            const isEmailUser = user?.providerData.some(p => p.providerId === 'password');
            const needsVerification = isEmailUser && !user?.emailVerified;
            
            const isAuthRoute = pathname === '/login' || pathname === '/register' || pathname === '/';
            const isVerificationRoute = pathname === '/verify-email';

            if (!user && !isAuthRoute && !isVerificationRoute) {
                // Not logged in -> go to login
                router.push('/login');
            } else if (user) {
                if (needsVerification && !isVerificationRoute) {
                    // Logged in but needs verification -> go to verification page
                    router.push('/verify-email');
                } else if (!needsVerification && (isAuthRoute || isVerificationRoute)) {
                    // Logged in and verified -> go to dashboard
                    router.push('/dashboard');
                }
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-950">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
