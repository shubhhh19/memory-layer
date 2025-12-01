'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, getUser, isAuthenticated, clearAuthTokens } from '@/lib/auth';
import { memoryMeshAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const refreshUser = async () => {
        if (!isAuthenticated()) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const response = await memoryMeshAPI.getCurrentUser();
            if (response.data) {
                setUser(response.data);
            } else {
                clearAuthTokens();
                setUser(null);
            }
        } catch (error) {
            clearAuthTokens();
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await memoryMeshAPI.logout();
        } catch (error) {
            // Ignore errors
        } finally {
            clearAuthTokens();
            setUser(null);
            router.push('/login');
        }
    };

    useEffect(() => {
        // Load user from storage first
        const storedUser = getUser();
        if (storedUser) {
            setUser(storedUser);
        }

        // Then refresh from API
        refreshUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

